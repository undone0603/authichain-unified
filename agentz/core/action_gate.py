# AgentZ port of AI Adapt research build 2026-10-01 Action Gate (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-01-action-gate.md
"""
action_gate.py — Mid-Harness-style action gate for AuthiChain ops bots (v0.1)

Pattern (after arXiv:2609.39982, "Mid-Harness"):
  1. The bot's generator proposes N candidate actions for the current state.
  2. A verifier compares candidates pairwise (knockout bracket) and picks one.
  3. Only the winner is forwarded to the harness for execution.
  4. Every decision emits a tamper-evident receipt (SHA-256 over canonical JSON),
     ready to insert into Supabase `public.agent_action_receipts`.

Design rules:
  - Zero third-party dependencies (stdlib only). Anthropic API via urllib.
  - LLM calls are injected callables, so the gate is testable offline.
  - Read-only actions bypass the gate (no extra cost); only side-effecting
    actions (send, write, deploy, delete, pay) are gated.
  - Fail-safe: if the verifier errors, the gate returns NO action (abstain),
    never a silent fallback to an unverified candidate.
"""
from __future__ import annotations

import hashlib
import json
import os
import urllib.request
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Callable, Optional

GATE_VERSION = "action-gate/0.1"
SIDE_EFFECT_VERBS = ("send", "write", "insert", "update", "delete", "deploy",
                     "publish", "pay", "transfer", "push", "post", "email")

# An LLM is any callable: (system_prompt, user_prompt) -> text
LLM = Callable[[str, str], str]


# ---------------------------------------------------------------- Anthropic
def anthropic_llm(model: str = "claude-sonnet-5-5", max_tokens: int = 800,
                  temperature: float = 1.0) -> LLM:
    """Return an LLM callable backed by the Anthropic Messages API.
    Requires ANTHROPIC_API_KEY. Model name is configurable — set it to
    whatever your account uses."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    def call(system: str, user: str) -> str:
        body = json.dumps({
            "model": model, "max_tokens": max_tokens, "temperature": temperature,
            "system": system, "messages": [{"role": "user", "content": user}],
        }).encode()
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages", data=body, method="POST",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read())
        return "".join(b.get("text", "") for b in data.get("content", []))
    return call


# ---------------------------------------------------------------- data
@dataclass
class Decision:
    bot: str
    state: str
    gated: bool
    candidates: list[str]
    chosen: Optional[str]
    chosen_index: Optional[int]
    comparisons: list[dict] = field(default_factory=list)
    abstained: bool = False
    error: Optional[str] = None
    gate_version: str = GATE_VERSION
    decided_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    receipt_sha256: str = ""

    def seal(self) -> "Decision":
        payload = {k: v for k, v in asdict(self).items() if k != "receipt_sha256"}
        canon = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        self.receipt_sha256 = hashlib.sha256(canon.encode("utf-8")).hexdigest()
        return self

    def verify_seal(self) -> bool:
        claimed = self.receipt_sha256
        ok = self.seal().receipt_sha256 == claimed
        self.receipt_sha256 = claimed
        return ok

    def to_row(self) -> dict:
        """Row shape for public.agent_action_receipts (see migration SQL)."""
        return {
            "bot": self.bot, "gate_version": self.gate_version, "gated": self.gated,
            "state": self.state, "candidates": self.candidates, "chosen": self.chosen,
            "chosen_index": self.chosen_index, "comparisons": self.comparisons,
            "abstained": self.abstained, "error": self.error,
            "decided_at": self.decided_at, "receipt_sha256": self.receipt_sha256,
        }


# ---------------------------------------------------------------- prompts
GEN_SYSTEM = ("You are the action generator for an operations bot. Propose exactly ONE "
              "next action as a single concrete command or API call. Output only the action.")
VER_SYSTEM = ("You are a strict action verifier. Given a task state and two candidate "
              "actions, pick the one more likely to make correct, safe, reversible progress. "
              "Penalise destructive, irreversible, out-of-scope or malformed actions. "
              'Respond with JSON only: {"winner": "A" or "B", "reason": "<one sentence>"}')


def is_side_effecting(action_hint: str) -> bool:
    h = action_hint.lower()
    return any(v in h for v in SIDE_EFFECT_VERBS)


def _parse_verdict(text: str) -> tuple[str, str]:
    s, e = text.find("{"), text.rfind("}")
    if s == -1 or e == -1:
        raise ValueError(f"verifier returned no JSON: {text[:120]!r}")
    obj = json.loads(text[s:e + 1])
    w = str(obj.get("winner", "")).strip().upper()
    if w not in ("A", "B"):
        raise ValueError(f"verifier winner invalid: {w!r}")
    return w, str(obj.get("reason", ""))[:500]


# ---------------------------------------------------------------- gate
def gate(bot: str, state: str, generator: LLM, verifier: LLM, n: int = 4,
         action_hint: str = "", force_gate: bool = False) -> Decision:
    """Run the action gate. `action_hint` is the bot's declared action type
    (e.g. 'send email'); read-only hints skip verification."""
    gated = force_gate or is_side_effecting(action_hint)
    k = n if gated else 1
    cands: list[str] = []
    for _ in range(k):
        c = generator(GEN_SYSTEM, state).strip()
        if c and c not in cands:          # dedupe identical proposals
            cands.append(c)

    if not cands:
        return Decision(bot, state, gated, [], None, None, abstained=True,
                        error="generator produced no candidates").seal()
    if not gated or len(cands) == 1:
        return Decision(bot, state, gated, cands, cands[0], 0).seal()

    # Knockout bracket: N-1 pairwise comparisons.
    comparisons: list[dict] = []
    alive = list(range(len(cands)))
    try:
        while len(alive) > 1:
            nxt = []
            for i in range(0, len(alive), 2):
                if i + 1 >= len(alive):
                    nxt.append(alive[i]); continue
                a, b = alive[i], alive[i + 1]
                prompt = (f"TASK STATE:\n{state}\n\nCANDIDATE A:\n{cands[a]}\n\n"
                          f"CANDIDATE B:\n{cands[b]}")
                w, reason = _parse_verdict(verifier(VER_SYSTEM, prompt))
                win = a if w == "A" else b
                comparisons.append({"a": a, "b": b, "winner": win, "reason": reason})
                nxt.append(win)
            alive = nxt
    except Exception as ex:  # fail-safe: abstain, never execute unverified
        return Decision(bot, state, gated, cands, None, None, comparisons,
                        abstained=True, error=f"verifier error: {ex}").seal()

    idx = alive[0]
    return Decision(bot, state, gated, cands, cands[idx], idx, comparisons).seal()


if __name__ == "__main__":
    import sys
    st = sys.argv[1] if len(sys.argv) > 1 else "Send the daily digest email to the founder."
    gen = anthropic_llm(temperature=1.0)
    ver = anthropic_llm(temperature=0.0, max_tokens=200)
    d = gate("demo-bot", st, gen, ver, n=4, action_hint="send email")
    print(json.dumps(d.to_row(), indent=2))
