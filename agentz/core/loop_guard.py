# AgentZ port of AI Adapt research build 2026-10-22 LoopGuard (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-22-loopguard-deloop.md
"""LoopGuard — tool-call loop detection + DeLoop-style preference-pair mining.

Reimplemented from the method in arXiv:2610.19376 (DeLoop, Chen et al., 2026).
The authors' repo (github.com/cskyl/deloop) ships only a project page and no
LICENSE, so no code is copied; this is an independent implementation.

Definition (from the paper): a *loop* is a step where the agent re-issues a
tool call it already made earlier in the rollout AND gets back exactly the
same observation — a step that adds no new information.

Two uses:
  1. Runtime guard  — LoopGuard.check()/after() inside a harness: warn, serve
     a cached observation for idempotent tools, or halt after a loop budget.
  2. Training data  — extract_dpo_pairs(): looping action = rejected,
     first later non-looping action in the same rollout = chosen.
     No task rewards, gold answers or LLM judges required.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable

__all__ = ["call_fingerprint", "obs_digest", "Step", "LoopGuard",
           "mark_loops", "extract_dpo_pairs", "loop_metrics", "guarded"]


def _canon(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), default=str)


def call_fingerprint(tool: str, args: dict | None) -> str:
    """Stable hash of a tool call; argument order does not matter."""
    return hashlib.sha256(f"{tool}\x00{_canon(args or {})}".encode()).hexdigest()


def obs_digest(observation: Any) -> str:
    text = observation if isinstance(observation, str) else _canon(observation)
    return hashlib.sha256(text.encode()).hexdigest()


@dataclass
class Step:
    tool: str
    args: dict
    observation: Any = None
    is_loop: bool = False

    @property
    def call_id(self) -> str:
        return call_fingerprint(self.tool, self.args)


def mark_loops(steps: list[Step]) -> list[Step]:
    """Flag each step whose (call, observation) pair already occurred earlier."""
    seen: set[tuple[str, str]] = set()
    for s in steps:
        key = (s.call_id, obs_digest(s.observation))
        s.is_loop = key in seen
        seen.add(key)
    return steps


def extract_dpo_pairs(steps: list[Step], context_fn: Callable[[list[Step]], Any] | None = None) -> list[dict]:
    """DeLoop pairs: rejected = looping action, chosen = first later non-looping action.

    context_fn(history) builds the prompt from steps[:i]; default = list of dicts.
    Loops with no later non-looping action yield no pair (nothing to prefer).
    """
    mark_loops(steps)
    ctx = context_fn or (lambda h: [{"tool": s.tool, "args": s.args, "observation": s.observation} for s in h])
    pairs = []
    for i, s in enumerate(steps):
        if not s.is_loop:
            continue
        nxt = next((t for t in steps[i + 1:] if not t.is_loop), None)
        if nxt is None:
            continue
        pairs.append({
            "prompt": ctx(steps[:i]),
            "rejected": {"tool": s.tool, "args": s.args},
            "chosen": {"tool": nxt.tool, "args": nxt.args},
            "loop_index": i,
        })
    return pairs


def loop_metrics(rollouts: Iterable[list[Step]]) -> dict:
    rollouts = [mark_loops(r) for r in rollouts]
    n = len(rollouts)
    with_loop = sum(1 for r in rollouts if any(s.is_loop for s in r))
    total_steps = sum(len(r) for r in rollouts)
    loop_steps = sum(s.is_loop for r in rollouts for s in r)
    return {
        "rollouts": n,
        "share_with_loops": (with_loop / n) if n else 0.0,
        "avg_steps": (total_steps / n) if n else 0.0,
        "loop_step_share": (loop_steps / total_steps) if total_steps else 0.0,
    }


@dataclass
class LoopGuard:
    """Runtime guard. Call check() before executing a tool, after() once you have the result.

    idempotent_tools: tools safe to short-circuit — a repeated call returns the cached
        observation plus a nudge instead of hitting the tool again.
    max_loops: loops tolerated before verdict 'halt'.
    """
    idempotent_tools: set[str] = field(default_factory=set)
    max_loops: int = 3
    loops: int = 0
    _cache: dict[str, str] = field(default_factory=dict)       # call_id -> obs digest
    _obs: dict[str, Any] = field(default_factory=dict)         # call_id -> observation
    history: list[Step] = field(default_factory=list)

    NUDGE = ("[loopguard] You already made this exact call and got this exact result. "
             "It adds no new information — choose a different action.")

    def check(self, tool: str, args: dict) -> dict:
        cid = call_fingerprint(tool, args)
        if self.loops >= self.max_loops:
            return {"verdict": "halt", "reason": f"loop budget {self.max_loops} exhausted"}
        if cid in self._cache and tool in self.idempotent_tools:
            return {"verdict": "cached", "observation": self._obs[cid], "nudge": self.NUDGE}
        return {"verdict": "execute", "repeat_call": cid in self._cache}

    def after(self, tool: str, args: dict, observation: Any) -> dict:
        cid = call_fingerprint(tool, args)
        dig = obs_digest(observation)
        is_loop = self._cache.get(cid) == dig
        if is_loop:
            self.loops += 1
        self._cache[cid] = dig
        self._obs[cid] = observation
        self.history.append(Step(tool, args, observation, is_loop))
        verdict = "halt" if self.loops >= self.max_loops and is_loop else ("loop" if is_loop else "ok")
        return {"verdict": verdict, "loops": self.loops, "nudge": self.NUDGE if is_loop else None}

    def record_cached(self, tool: str, args: dict) -> None:
        """Count a short-circuited repeat as a loop (it would have been one)."""
        cid = call_fingerprint(tool, args)
        self.loops += 1
        self.history.append(Step(tool, args, self._obs[cid], True))


def guarded(guard: LoopGuard, tool_name: str, fn: Callable[..., Any]) -> Callable[..., Any]:
    """Wrap a tool function: returns observation (str-annotated on loops) or raises on halt."""
    def _wrapped(**kwargs):
        pre = guard.check(tool_name, kwargs)
        if pre["verdict"] == "halt":
            raise RuntimeError(pre["reason"])
        if pre["verdict"] == "cached":
            guard.record_cached(tool_name, kwargs)
            return {"observation": pre["observation"], "loopguard": pre["nudge"]}
        obs = fn(**kwargs)
        post = guard.after(tool_name, kwargs, obs)
        if post["verdict"] == "halt":
            raise RuntimeError(f"loop budget {guard.max_loops} exhausted")
        return {"observation": obs, "loopguard": post["nudge"]}
    return _wrapped
