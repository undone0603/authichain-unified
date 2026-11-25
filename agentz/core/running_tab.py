# AgentZ port of AI Adapt research build 2026-10-08 RunningTab (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-08-running-tab.md
"""running_tab — environment-side task ledger for agent deliverables.

Reimplemented from the method described in arXiv:2610.10444 (RunningTab, KAIST AI).
No code was released with the paper; nothing here is copied from any repository.

The environment (not the model) keeps a per-task "tab":
  * requirements the agent says the task owes,
  * every file read, stored as an excerpt with provenance (path, offsets, sha256),
  * every file listed but never opened, kept as a candidate.
Before the agent may finish, finish_check() returns every requirement that is
neither resolved against a recorded excerpt nor set aside with a reason.
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Callable, Optional

_TOKEN = re.compile(r"[a-z0-9]+")
_STOP = {"the", "a", "an", "of", "and", "or", "to", "in", "for", "on", "with", "is", "are", "by", "from", "what", "which"}


def _tokens(text: str) -> set[str]:
    return {t for t in _TOKEN.findall(text.lower()) if t not in _STOP and len(t) > 1}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


@dataclass
class Excerpt:
    id: str
    path: str
    start: int
    end: int
    text: str
    file_sha256: str
    excerpt_sha256: str
    read_at: str


@dataclass
class Requirement:
    id: str
    text: str
    status: str = "open"            # open | resolved | set_aside
    evidence: list[str] = field(default_factory=list)   # excerpt ids
    value: Optional[str] = None
    reason: Optional[str] = None


class FinishBlocked(Exception):
    def __init__(self, open_reqs: list[Requirement]):
        self.open_reqs = open_reqs
        super().__init__("finish blocked; open requirements: " + ", ".join(r.id for r in open_reqs))


class RunningTab:
    """Kept by the environment. The agent only calls the public methods."""

    def __init__(self, task_id: str, reader: Callable[[str], str], lister: Callable[[str], list[str]],
                 excerpt_chars: int = 600):
        self.task_id = task_id
        self._reader = reader
        self._lister = lister
        self.excerpt_chars = excerpt_chars
        self.requirements: dict[str, Requirement] = {}
        self.excerpts: dict[str, Excerpt] = {}
        self.read_paths: set[str] = set()
        self.candidates: set[str] = set()
        self.events: list[dict] = []

    # ---- environment-side tools (agent's file access goes through these) ----
    def list_dir(self, directory: str) -> list[str]:
        paths = list(self._lister(directory))
        for p in paths:
            if p not in self.read_paths:
                self.candidates.add(p)
        self._log("list", directory=directory, n=len(paths))
        return paths

    def read_file(self, path: str) -> str:
        content = self._reader(path)
        file_hash = sha256(content)
        self.read_paths.add(path)
        self.candidates.discard(path)
        step = self.excerpt_chars
        for i, start in enumerate(range(0, max(len(content), 1), step)):
            chunk = content[start:start + step]
            eid = f"{path}#{i}"
            self.excerpts[eid] = Excerpt(eid, path, start, start + len(chunk), chunk,
                                         file_hash, sha256(chunk), _now())
        self._log("read", path=path, file_sha256=file_hash)
        return content

    # ---- agent-side bookkeeping ----
    def add_requirement(self, text: str) -> str:
        rid = f"R{len(self.requirements) + 1}"
        self.requirements[rid] = Requirement(rid, text)
        self._log("add_requirement", id=rid)
        return rid

    def view(self, rid: str, k: int = 3) -> dict:
        """A requirement beside its best-matching excerpts and top unopened candidates."""
        req = self.requirements[rid]
        q = _tokens(req.text)
        scored = []
        for e in self.excerpts.values():
            overlap = len(q & _tokens(e.text))
            if overlap:
                scored.append((overlap / max(len(q), 1), e.id))
        scored.sort(key=lambda x: (-x[0], x[1]))
        cand = sorted(self.candidates,
                      key=lambda p: (-len(q & _tokens(p.replace("/", " ").replace("_", " "))), p))
        return {"requirement": asdict(req),
                "excerpts": [{"id": eid, "score": round(s, 3), "text": self.excerpts[eid].text[:200]}
                             for s, eid in scored[:k]],
                "unopened_candidates": cand[:k]}

    def resolve(self, rid: str, excerpt_ids: list[str], value: str) -> None:
        if not excerpt_ids:
            raise ValueError("resolve needs at least one excerpt id")
        missing = [e for e in excerpt_ids if e not in self.excerpts]
        if missing:
            raise KeyError(f"unknown excerpt ids (never read): {missing}")
        req = self.requirements[rid]
        req.status, req.evidence, req.value = "resolved", list(excerpt_ids), value
        self._log("resolve", id=rid, evidence=excerpt_ids)

    def set_aside(self, rid: str, reason: str) -> None:
        if not reason or not reason.strip():
            raise ValueError("set_aside needs a reason")
        req = self.requirements[rid]
        req.status, req.reason = "set_aside", reason.strip()
        self._log("set_aside", id=rid)

    def finish_check(self) -> list[Requirement]:
        return [r for r in self.requirements.values() if r.status == "open"]

    def finish(self, deliverable: str) -> dict:
        open_reqs = self.finish_check()
        if open_reqs:
            self._log("finish_blocked", open=[r.id for r in open_reqs])
            raise FinishBlocked(open_reqs)
        # every resolved value must actually appear in the deliverable
        dropped = [r.id for r in self.requirements.values()
                   if r.status == "resolved" and r.value and r.value not in deliverable]
        if dropped:
            self._log("finish_blocked", dropped=dropped)
            raise FinishBlocked([self.requirements[d] for d in dropped])
        receipt = self.receipt(deliverable)
        self._log("finish", deliverable_sha256=receipt["deliverable_sha256"])
        return receipt

    def receipt(self, deliverable: str) -> dict:
        """Provenance receipt: each requirement -> evidence excerpt hashes."""
        return {
            "task_id": self.task_id,
            "deliverable_sha256": sha256(deliverable),
            "requirements": [
                {"id": r.id, "text": r.text, "status": r.status, "value": r.value, "reason": r.reason,
                 "evidence": [{"path": self.excerpts[e].path, "start": self.excerpts[e].start,
                               "end": self.excerpts[e].end, "excerpt_sha256": self.excerpts[e].excerpt_sha256,
                               "file_sha256": self.excerpts[e].file_sha256} for e in r.evidence]}
                for r in self.requirements.values()],
            "unopened_candidates": sorted(self.candidates),
        }

    def to_json(self) -> str:
        return json.dumps({"task_id": self.task_id,
                           "requirements": [asdict(r) for r in self.requirements.values()],
                           "excerpts": [asdict(e) for e in self.excerpts.values()],
                           "candidates": sorted(self.candidates), "events": self.events}, indent=2)

    def _log(self, kind: str, **kw) -> None:
        self.events.append({"at": _now(), "kind": kind, **kw})
