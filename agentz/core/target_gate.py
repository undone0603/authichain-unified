# AgentZ port of AI Adapt research build 2026-11-18 TargetGate (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-18-targetgate-typed-target-admission.md
"""TargetGate: deterministic admission floor for where an agent's actions go.

Reimplemented from the method in SPILLWAY (arXiv:2611.07222). Written fresh;
no code copied from the released repo (which is Apache-2.0).

Rule: a side-effecting tool call is ADMITTED only if every target value
(recipient, account, url, path ...) is either
  (1) present in the user's own task text, or
  (2) returned by a READ-ONLY tool in a TYPED field (not free text), or
  (3) covered by a fixed delegation rule (e.g. an owner allowlist).
Free text from tools is sanitized first; removed instruction-like spans are
kept as evidence. An optional judge may restore a refused call, never one
whose target appears inside removed text.
"""
from __future__ import annotations
import hashlib, json, re
from dataclasses import dataclass, field
from typing import Callable, Optional

ADMIT, REFUSE, RESTORED = "ADMIT", "REFUSE", "RESTORED"

INSTRUCTION_RULES = [
    r"(?i)ignore (all |any )?(previous|prior|above) instructions[^\n]*?(?:\.(?=\s|$)|\n|$)",
    r"(?i)\b(you must|you should|please) (now )?(send|forward|transfer|pay|email|upload|delete)\b[^\n.]*?\bto\b[^\n]*?(?:\.(?=\s|$)|\n|$)",
    r"(?i)\b(system|assistant)\s*:\s*[^\n]*",
    r"(?i)<\|?(im_start|im_end|system)\|?>[^\n]*",
    r"(?i)\bnew instructions?\b[^\n]*?(?:\.(?=\s|$)|\n|$)",
]

def norm(v: str) -> str:
    return v.strip().lower().rstrip("/")

@dataclass
class ToolResult:
    tool: str
    read_only: bool
    typed: dict          # field -> value or list of values
    free_text: str = ""

@dataclass
class Sanitized:
    text: str
    removed: list        # [(start, end, span)]

def sanitize(text: str) -> Sanitized:
    spans = []
    for rule in INSTRUCTION_RULES:
        for m in re.finditer(rule, text):
            spans.append((m.start(), m.end(), m.group(0)))
    spans.sort()
    merged = []
    for s, e, _ in spans:
        if merged and s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    out, last, removed = [], 0, []
    for s, e in merged:
        out.append(text[last:s]); out.append("[removed]")
        removed.append((s, e, text[s:e])); last = e
    out.append(text[last:])
    return Sanitized("".join(out), removed)

@dataclass
class Call:
    tool: str
    targets: dict        # arg name -> value

@dataclass
class TargetGate:
    task: str
    delegation: dict = field(default_factory=dict)   # arg name -> set of allowed values / suffixes
    judge: Optional[Callable[[Call, str], bool]] = None
    _typed: set = field(default_factory=set)
    _removed: list = field(default_factory=list)
    ledger: list = field(default_factory=list)

    def observe(self, r: ToolResult) -> str:
        """Ingest a tool result; returns the sanitized free text the model may read."""
        if r.read_only:
            for v in r.typed.values():
                for x in (v if isinstance(v, list) else [v]):
                    if isinstance(x, str):
                        self._typed.add(norm(x))
        s = sanitize(r.free_text)
        self._removed.extend(span for _, _, span in s.removed)
        return s.text

    def _covered(self, arg: str, value: str) -> Optional[str]:
        v = norm(value)
        if v in norm(self.task) or value in self.task:
            return "in_task"
        if v in self._typed:
            return "typed_read_only"
        for rule in self.delegation.get(arg, ()):
            r = norm(rule)
            if v == r or (r.startswith("@") and v.endswith(r)):
                return "delegation"
        return None

    def _in_removed(self, value: str) -> bool:
        v = norm(value)
        return any(v in norm(span) for span in self._removed)

    def admit(self, call: Call) -> str:
        reasons, uncovered = {}, []
        for arg, value in call.targets.items():
            why = self._covered(arg, value)
            reasons[arg] = why or "uncovered"
            if not why:
                uncovered.append((arg, value))
        verdict = ADMIT if not uncovered else REFUSE
        if verdict == REFUSE and self.judge is not None:
            if not any(self._in_removed(v) for _, v in uncovered) and self.judge(call, self.task):
                verdict = RESTORED
        self._log(call, verdict, reasons)
        return verdict

    def _log(self, call, verdict, reasons):
        prev = self.ledger[-1]["sha256"] if self.ledger else ""
        body = {"tool": call.tool, "targets": call.targets, "verdict": verdict,
                "reasons": reasons, "prev": prev}
        body["sha256"] = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()
        self.ledger.append(body)

    def verify_ledger(self) -> bool:
        prev = ""
        for row in self.ledger:
            b = {k: v for k, v in row.items() if k != "sha256"}
            if b["prev"] != prev:
                return False
            if hashlib.sha256(json.dumps(b, sort_keys=True).encode()).hexdigest() != row["sha256"]:
                return False
            prev = row["sha256"]
        return True
