# AgentZ port of AI Adapt research build 2026-10-15 Skillmark (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-15-skillmark-skill-watermark.md
"""skillmark — keyed KGW-style watermarking for agent SKILL.md files.

Clean-room reimplementation of the method described in arXiv:2610.15725
(SkillMarker). The authors' repo has no LICENSE file, so no code was copied.

Pipeline:
  1. split(): separate PROTECTED content (frontmatter, code, inline code, URLs,
     numbers, headings, imperative keywords) from EDITABLE prose sentences.
  2. embed(): for each editable sentence, ask a rewriter (any LLM callable) for
     N candidate paraphrases; drop candidates that break the quality constraint
     (protected tokens must survive); keep the one with the strongest keyed
     green-list signal. API-only: no logit access needed.
  3. detect(): z-score of green tokens under the key; window scan for partial copies.
"""
from __future__ import annotations
import hashlib, hmac, math, re
from dataclasses import dataclass, field
from typing import Callable, List

GAMMA = 0.25            # green-list fraction
Z_THRESHOLD = 4.0       # detection threshold (one-sided)
_WORD = re.compile(r"[A-Za-z][A-Za-z'-]*")
_PROTECT_IN_SENTENCE = re.compile(
    r"`[^`]*`|https?://\S+|\b\d[\d.,:%/-]*\b|\b(?:MUST|NEVER|ALWAYS|NOT|DO|DON'T|ONLY)\b")

Rewriter = Callable[[str, int], List[str]]   # (sentence, n) -> candidate rewrites


def _tokens(text: str) -> List[str]:
    return [w.lower() for w in _WORD.findall(text)]


def _is_green(key: bytes, prev: str, tok: str) -> bool:
    d = hmac.new(key, f"{prev}\x00{tok}".encode(), hashlib.sha256).digest()
    return int.from_bytes(d[:8], "big") / 2**64 < GAMMA


def score(text: str, key: bytes) -> dict:
    toks = _tokens(text)
    t = len(toks) - 1
    if t < 1:
        return {"tokens": 0, "green": 0, "z": 0.0}
    g = sum(_is_green(key, toks[i - 1], toks[i]) for i in range(1, len(toks)))
    z = (g - GAMMA * t) / math.sqrt(t * GAMMA * (1 - GAMMA))
    return {"tokens": t, "green": g, "z": round(z, 3)}


def green_fraction(text: str, key: bytes) -> float:
    s = score(text, key)
    return s["green"] / s["tokens"] if s["tokens"] else 0.0


@dataclass
class Segment:
    text: str
    editable: bool


def split(skill_md: str) -> List[Segment]:
    """Frontmatter, fenced code, headings, tables and blank lines are protected;
    prose lines are split into editable sentences."""
    segs: List[Segment] = []
    lines = skill_md.splitlines(keepends=True)
    i, in_code, in_fm = 0, False, False
    if lines and lines[0].strip() == "---":
        in_fm = True
    for idx, line in enumerate(lines):
        s = line.strip()
        if in_fm:
            segs.append(Segment(line, False))
            if s == "---" and idx > 0:
                in_fm = False
            continue
        if s.startswith("```"):
            in_code = not in_code
            segs.append(Segment(line, False)); continue
        if in_code or not s or s.startswith(("#", "|", ">")):
            segs.append(Segment(line, False)); continue
        # prose line: keep list markers protected, sentences editable
        m = re.match(r"^(\s*(?:[-*+]|\d+\.)\s+)?(.*?)(\s*)$", line, re.S)
        prefix, body, tail = m.group(1) or "", m.group(2), m.group(3)
        if prefix:
            segs.append(Segment(prefix, False))
        parts = re.split(r"(?<=[.!?])(\s+)", body)
        for p in parts:
            if not p:
                continue
            segs.append(Segment(p, bool(_WORD.search(p)) and not p.isspace()))
        segs.append(Segment(tail, False))
    return segs


def _protected_atoms(sentence: str) -> List[str]:
    return sorted(_PROTECT_IN_SENTENCE.findall(sentence))


def quality_ok(original: str, candidate: str, max_len_ratio: float = 1.5) -> bool:
    """Quality constraint: every protected atom survives verbatim, same count;
    length stays within bounds."""
    if _protected_atoms(original) != _protected_atoms(candidate):
        return False
    lo, hi = len(original) / max_len_ratio, len(original) * max_len_ratio
    return lo <= len(candidate) <= hi


@dataclass
class EmbedReport:
    text: str
    sentences: int = 0
    rewritten: int = 0
    rejected_candidates: int = 0
    z: float = 0.0
    sha256: str = ""
    audit: dict = field(default_factory=dict)


def embed(skill_md: str, key: bytes, rewriter: Rewriter, n_candidates: int = 8) -> EmbedReport:
    rep = EmbedReport(text="")
    out = []
    for seg in split(skill_md):
        if not seg.editable:
            out.append(seg.text); continue
        rep.sentences += 1
        best, best_g = seg.text, green_fraction(seg.text, key)
        for cand in rewriter(seg.text, n_candidates):
            if not quality_ok(seg.text, cand):
                rep.rejected_candidates += 1; continue
            g = green_fraction(cand, key)
            if g > best_g:
                best, best_g = cand, g
        if best != seg.text:
            rep.rewritten += 1
        out.append(best)
    rep.text = "".join(out)
    rep.z = score(rep.text, key)["z"]
    rep.sha256 = hashlib.sha256(rep.text.encode()).hexdigest()
    rep.audit = audit(skill_md, rep.text)
    return rep


def audit(original: str, marked: str) -> dict:
    """Protected (non-editable) segments must be byte-identical."""
    a = [s.text for s in split(original) if not s.editable and s.text.strip()]
    b = [s.text for s in split(marked) if not s.editable and s.text.strip()]
    return {"protected_segments": len(a), "protected_identical": a == b}


def detect(text: str, key: bytes, window: int = 120, stride: int = 40) -> dict:
    """Whole-document z plus max sliding-window z (catches partial copies)."""
    whole = score(text, key)
    toks = _tokens(text)
    best = whole["z"]
    if len(toks) > window:
        for start in range(0, len(toks) - window + 1, stride):
            best = max(best, score(" ".join(toks[start:start + window]), key)["z"])
    return {"z": whole["z"], "max_window_z": round(best, 3),
            "detected": max(whole["z"], best) >= Z_THRESHOLD}
