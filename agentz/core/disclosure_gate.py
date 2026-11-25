# AgentZ port of AI Adapt research build 2026-11-10 DisclosureGate (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-10-disclosuregate-fraud-modes.md
"""DisclosureGate: pre-send check of agent-written commercial messages for the two
fraud modes measured by FraudBench (arXiv:2611.12167): misrepresentation (a claim
contradicted by a known material fact) and concealment (a must-disclose fact that is
relevant to the message but missing). Reimplemented from the paper's definitions;
no FraudBench code or data is used (CC BY-NC-SA 4.0).

Policy follows the paper's finding that fraud rates rise with autonomy:
advise -> WARN, draft -> REVISE, act -> HOLD (fail closed).
"""
from __future__ import annotations
import hashlib, json, re
from dataclasses import dataclass, field
from typing import Callable, Iterable, Optional

AUTONOMY = ("advise", "draft", "act")

LAW_PREAMBLE = ("Follow applicable law. Do not misrepresent or conceal any material fact "
                "about the product, its testing, certification or regulatory status.")


@dataclass(frozen=True)
class Fact:
    id: str
    statement: str
    topics: frozenset
    must_disclose: bool = False
    forbidden_claims: tuple = ()       # regexes that contradict this fact
    disclosure_patterns: tuple = ()    # regexes, any one satisfies disclosure


@dataclass
class Violation:
    kind: str          # MISREPRESENTATION | CONCEALMENT | UNMEASURABLE
    fact_id: Optional[str]
    detail: str


@dataclass
class Decision:
    verdict: str       # PASS | WARN | REVISE | HOLD
    violations: list = field(default_factory=list)
    required_disclosures: list = field(default_factory=list)
    receipt: dict = field(default_factory=dict)


def keyword_topics(text: str, vocab: dict) -> set:
    """vocab: topic -> list of keywords. Case-insensitive whole-word match."""
    low = text.lower()
    return {t for t, kws in vocab.items()
            if any(re.search(r"\b" + re.escape(k.lower()) + r"\b", low) for k in kws)}


def check(message: str, facts: Iterable[Fact], autonomy: str, *,
          topic_vocab: Optional[dict] = None,
          topic_extractor: Optional[Callable[[str], Iterable[str]]] = None) -> Decision:
    if autonomy not in AUTONOMY:
        raise ValueError(f"autonomy must be one of {AUTONOMY}")
    facts = list(facts)
    violations: list = []

    topics: Optional[set] = None
    if topic_extractor is not None:
        try:
            topics = set(topic_extractor(message))
        except Exception as exc:  # extractor failure is never "no topics"
            violations.append(Violation("UNMEASURABLE", None, f"topic extractor failed: {exc}"))
    if topics is None and not violations:
        topics = keyword_topics(message, topic_vocab or {})
    if topics is None:
        topics = keyword_topics(message, topic_vocab or {}) if topic_vocab else set()

    for f in facts:
        for pat in f.forbidden_claims:
            m = re.search(pat, message, re.I)
            if m:
                violations.append(Violation("MISREPRESENTATION", f.id,
                                            f"claim '{m.group(0)}' contradicts: {f.statement}"))
                break

    required = []
    for f in facts:
        if f.must_disclose and (f.topics & topics):
            if not any(re.search(p, message, re.I) for p in f.disclosure_patterns):
                violations.append(Violation("CONCEALMENT", f.id,
                                            f"relevant fact not disclosed: {f.statement}"))
                required.append(f.statement)

    if not violations:
        verdict = "PASS"
    elif autonomy == "advise":
        verdict = "WARN"
    elif autonomy == "draft":
        verdict = "HOLD" if any(v.kind == "UNMEASURABLE" for v in violations) else "REVISE"
    else:
        verdict = "HOLD"

    receipt = {
        "message_sha256": hashlib.sha256(message.encode()).hexdigest(),
        "autonomy": autonomy,
        "topics": sorted(topics),
        "fact_ids_checked": sorted(f.id for f in facts),
        "verdict": verdict,
        "violations": [[v.kind, v.fact_id] for v in violations],
    }
    return Decision(verdict, violations, required, receipt)


def facts_from_rows(rows: Iterable[dict]) -> list:
    """Rows shaped like the PROPOSED public.material_facts table."""
    out = []
    for r in rows:
        out.append(Fact(r["id"], r["statement"], frozenset(r.get("topics") or []),
                        bool(r.get("must_disclose")), tuple(r.get("forbidden_claims") or []),
                        tuple(r.get("disclosure_patterns") or [])))
    return out


if __name__ == "__main__":
    print(json.dumps({"preamble": LAW_PREAMBLE}))
