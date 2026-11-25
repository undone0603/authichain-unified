# AgentZ port of AI Adapt research build 2026-11-12 ReadGate (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-12-readgate-budgeted-reading.md
"""ReadGate: a budgeted, auditable reading layer for agents.

Reimplemented from the ideas in "Read Less, Solve More" (SparseRead, arXiv:2608.22237).
No code was released with the paper; this is written fresh.

Three parts, mirroring the paper:
  1. ReadIntent   - tracks what the agent still needs (facets) and which are covered.
  2. Readers      - interchangeable backends that locate verbatim evidence spans.
  3. ReadGate     - bounds cumulative raw exposure per episode, with a faithful
                    full-view fallback when a reader finds nothing and budget allows.
Every exposure is written to a ledger (source sha256, offsets, chars) so you can
show afterwards exactly what the agent read and why.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from typing import Protocol

_WORD = re.compile(r"[a-z0-9]+")


def _terms(text: str) -> set[str]:
    return {w for w in _WORD.findall(text.lower()) if len(w) > 2}


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class Span:
    start: int
    end: int
    text: str
    facet: str | None
    score: float


@dataclass
class ReadIntent:
    need: str
    facets: dict[str, set[str]]  # facet name -> key terms
    covered: dict[str, list[str]] = field(default_factory=dict)  # facet -> source ids

    @classmethod
    def from_facets(cls, need: str, facets: dict[str, str]) -> "ReadIntent":
        return cls(need, {k: _terms(v) for k, v in facets.items()})

    def open_facets(self) -> list[str]:
        return [f for f in self.facets if f not in self.covered]

    def mark(self, facet: str, source_id: str) -> None:
        self.covered.setdefault(facet, []).append(source_id)

    @property
    def done(self) -> bool:
        return not self.open_facets()


class Reader(Protocol):
    name: str

    def locate(self, text: str, intent: ReadIntent) -> list[Span]: ...


class ChunkReader:
    """Splits on blank lines and scores each chunk by term overlap with open facets."""

    name = "chunk"

    def __init__(self, min_overlap: int = 2, max_spans: int = 3):
        self.min_overlap = min_overlap
        self.max_spans = max_spans

    def locate(self, text: str, intent: ReadIntent) -> list[Span]:
        spans: list[Span] = []
        for m in re.finditer(r"(?:(?!\n\s*\n).)+", text, flags=re.S):
            chunk_terms = _terms(m.group(0))
            best, best_facet = 0, None
            for facet in intent.open_facets():
                hit = len(chunk_terms & intent.facets[facet])
                if hit > best:
                    best, best_facet = hit, facet
            if best >= self.min_overlap:
                spans.append(Span(m.start(), m.end(), m.group(0), best_facet, float(best)))
        spans.sort(key=lambda s: -s.score)
        return spans[: self.max_spans]


class HeadingReader:
    """For markdown-like docs: returns whole sections whose heading names a facet term."""

    name = "heading"

    def locate(self, text: str, intent: ReadIntent) -> list[Span]:
        heads = list(re.finditer(r"^#+ .*$", text, flags=re.M))
        spans = []
        for i, h in enumerate(heads):
            end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
            head_terms = _terms(h.group(0))
            for facet in intent.open_facets():
                if head_terms & intent.facets[facet]:
                    spans.append(Span(h.start(), end, text[h.start():end], facet, 1.0))
                    break
        return spans


@dataclass
class Exposure:
    source_id: str
    source_sha256: str
    source_chars: int
    mode: str  # SPARSE | FULL_FALLBACK | DENIED_BUDGET | DENIED_NOTHING_FOUND
    reader: str
    offsets: list[tuple[int, int]]
    exposed_chars: int
    facets: list[str]


@dataclass
class ReadResult:
    mode: str
    spans: list[Span]
    exposed_chars: int
    note: str = ""


class ReadGate:
    def __init__(self, intent: ReadIntent, readers: list[Reader], episode_budget: int,
                 fallback_max_chars: int | None = None):
        self.intent = intent
        self.readers = readers
        self.budget = episode_budget
        self.fallback_max = fallback_max_chars if fallback_max_chars is not None else episode_budget
        self.used = 0
        self.ledger: list[Exposure] = []

    @property
    def remaining(self) -> int:
        return self.budget - self.used

    def read(self, source_id: str, text: str) -> ReadResult:
        spans: list[Span] = []
        reader_name = "none"
        for r in self.readers:
            spans = r.locate(text, self.intent)
            if spans:
                reader_name = r.name
                break
        if spans:
            spans = self._fit(spans)
            if not spans:
                return self._deny(source_id, text, "DENIED_BUDGET", "spans found but budget exhausted")
            for s in spans:
                assert text[s.start:s.end] == s.text  # faithful: verbatim only
                if s.facet:
                    self.intent.mark(s.facet, source_id)
            return self._record(source_id, text, "SPARSE", reader_name, spans)
        # nothing located: faithful full view if it fits, never a paraphrase
        if len(text) <= min(self.remaining, self.fallback_max):
            full = Span(0, len(text), text, None, 0.0)
            return self._record(source_id, text, "FULL_FALLBACK", "full", [full])
        mode = "DENIED_BUDGET" if len(text) > self.remaining else "DENIED_NOTHING_FOUND"
        return self._deny(source_id, text, mode, "no evidence located and full view not allowed")

    def _fit(self, spans: list[Span]) -> list[Span]:
        kept, total = [], 0
        for s in spans:
            if total + len(s.text) <= self.remaining:
                kept.append(s)
                total += len(s.text)
        return sorted(kept, key=lambda s: s.start)

    def _record(self, sid, text, mode, reader, spans) -> ReadResult:
        n = sum(len(s.text) for s in spans)
        self.used += n
        self.ledger.append(Exposure(sid, sha256(text), len(text), mode, reader,
                                    [(s.start, s.end) for s in spans], n,
                                    sorted({s.facet for s in spans if s.facet})))
        return ReadResult(mode, spans, n)

    def _deny(self, sid, text, mode, note) -> ReadResult:
        self.ledger.append(Exposure(sid, sha256(text), len(text), mode, "none", [], 0, []))
        return ReadResult(mode, [], 0, note)

    def summary(self) -> dict:
        offered = sum(e.source_chars for e in self.ledger)
        return {
            "need": self.intent.need,
            "budget": self.budget,
            "exposed_chars": self.used,
            "offered_chars": offered,
            "savings_ratio": round(1 - self.used / offered, 4) if offered else 0.0,
            "open_facets": self.intent.open_facets(),
            "reads": len(self.ledger),
            "modes": [e.mode for e in self.ledger],
        }

    def verify(self, sources: dict[str, str]) -> list[str]:
        """Re-check every ledger entry against the source text. Empty list = intact."""
        problems = []
        for e in self.ledger:
            src = sources.get(e.source_id)
            if src is None:
                problems.append(f"{e.source_id}: source unavailable")
            elif sha256(src) != e.source_sha256:
                problems.append(f"{e.source_id}: source changed since read")
        return problems
