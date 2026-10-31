"""Right-Side Brain: propose testable possibilities and stop before execution.

The step reads a signal and returns structured records. It does not spend,
send, deploy, change mode, write a ledger, or call the Left-Side path.
"""

from __future__ import annotations

import copy
import re

OPERATORS = (
    "reframe",
    "reverse",
    "simplify",
    "combine",
    "remove",
    "substitute",
    "invert",
    "generalize",
    "specialize",
)

HANDOFF_FIELDS = (
    "idea",
    "problem",
    "why_now",
    "supporting_evidence",
    "assumptions",
    "uncertainties",
    "expected_value",
    "potential_downside",
    "experiment",
    "success_criteria",
    "reversibility",
    "confidence",
)

AUTHORITY_ACTIONS = (
    "spend",
    "send",
    "deploy",
    "AgentZ --mode auto",
    "agentz mode auto",
    "Founder-law rewrite",
    "founder-law rewrite",
    "guardrail change",
    "irreversible commitment",
)

FUTURES = (
    "Most likely",
    "Best case",
    "Worst case",
    "Unexpected case",
    "Disruptive case",
)

FUTURE_FIELDS = (
    "opportunity",
    "threat",
    "leading indicators",
    "required capabilities",
    "potential response",
)

HYPOTHESIS_FIELDS = (
    "Hypothesis",
    "Why it might be true",
    "Evidence currently available",
    "Evidence missing",
    "Cheapest useful experiment",
    "Expected result",
    "Decision if confirmed",
    "Decision if rejected",
)

EXPLORATION_RANK = (
    ("WORTH INVESTIGATING", 0.85),
    ("UNKNOWN", 0.7),
    ("ASSUMED", 0.45),
    ("KNOWN", 0.25),
    ("NOT WORTH INVESTIGATING", 0.05),
)

CURIOSITY_FIELDS = (
    "Question",
    "Potential impact",
    "Information value",
    "Cost to investigate",
    "Time sensitivity",
    "Current uncertainty",
    "Recommended experiment",
)

CLAIM_LABELS = ("demonstrated", "supported", "estimated", "aspirational")

AUDIENCES = (
    ("technical", "technical explanation"),
    ("business", "business explanation"),
    ("customer", "customer explanation"),
    ("investor", "investor explanation"),
    ("founder", "founder-level strategic narrative"),
)

HUMAN_FACTORS = (
    "incentives",
    "stakeholder perspectives",
    "trust",
    "usability",
    "adoption friction",
    "organizational behavior",
    "cultural/contextual factors",
    "likely objections",
    "communication quality",
)

MEMORY_KINDS = (
    "ideas",
    "patterns",
    "analogies",
    "failed concepts",
    "successful concepts",
    "design principles",
    "strategic insights",
    "market signals",
    "experiments",
)

PRIMARY_METRIC = "verified value generated from previously unknown possibilities"

FORBIDDEN_PHRASES = (
    "customers feel",
    "customers love",
    "they believe",
    "the buyer wants",
    "market demand is",
    "people think",
)

_LABEL_RE = re.compile(
    r"^(demonstrated|supported|estimated|aspirational):\s+(\S.*)$",
    re.DOTALL,
)
_LABEL_WORD_RE = re.compile(
    r"\b(demonstrated|supported|estimated|aspirational)\b",
    re.IGNORECASE,
)
_STAT_RE = re.compile(r"\$\d[\d,]*(?:\.\d+)?|\b\d+(?:\.\d+)?%")

LAUNCH_BOTTLENECK = {
    "problem": "Public Farm checkout is still linked from pricing",
    "failed_method": "retry the same Stripe list",
    "why_now": "The catalogue link is on main and the public page still names Farm",
    "meaningful_opportunity": True,
    "kind": "bottleneck",
}

_IDEA_TEMPLATES = {
    "reframe": "reframe: state {subject} as a question about which public sentence is safe to show",
    "reverse": "reverse: begin from the public page that shows {subject} and walk back to the smallest reversible difference",
    "simplify": "simplify: reduce {subject} to one public sentence and one internal record",
    "combine": "combine: put the public-offer list beside the page that shows {subject} and read them together",
    "remove": "remove: take the public path for {subject} off the page and leave the internal record in place",
    "substitute": "substitute: point the page that shows {subject} at the offer the public list already names",
    "invert": "invert: publish that {subject} is not a public offer, instead of retrying the old check",
    "generalize": "generalize: if {subject} is confirmed, write a hypothesis that public pages name only public offers",
    "specialize": "specialize: limit the next check of {subject} to one page and one link",
}


class UntaggedClaim(ValueError):
    """A narrative claim has no single allowed label, or it invents a signal."""


class CreativeMemory:
    """In-memory creative store. Speculative items stay non-facts."""

    def __init__(self) -> None:
        self._records: list[dict] = []
        self._failures: dict[str, int] = {}
        self._lessons: list[dict] = []

    def store(self, kind: str, text: str, speculative: bool = True, **_ignored) -> dict:
        if kind not in MEMORY_KINDS:
            raise ValueError(f"unknown creative memory kind: {kind}")
        if not isinstance(text, str) or not text.strip():
            raise ValueError("creative memory text must be non-empty")
        record = {
            "kind": kind,
            "text": text,
            "speculative": bool(speculative),
            "organizational_fact": False,
        }
        self._records.append(record)
        return copy.deepcopy(record)

    def lookup(self, kind: str) -> list[dict]:
        if kind not in MEMORY_KINDS:
            raise ValueError(f"unknown creative memory kind: {kind}")
        return [copy.deepcopy(row) for row in self._records if row["kind"] == kind]

    def record_failure(self, idea: str) -> int:
        if not isinstance(idea, str) or not idea.strip():
            raise ValueError("a failed idea must be non-empty text")
        self._failures[idea] = self._failures.get(idea, 0) + 1
        self.store("failed concepts", idea)
        return self._failures[idea]

    def failure_count(self, idea: str) -> int:
        return self._failures.get(idea, 0)

    def failed_ideas(self) -> frozenset[str]:
        return frozenset(idea for idea, count in self._failures.items() if count >= 1)

    def record_verified(self, outcome: dict) -> dict:
        if not isinstance(outcome, dict) or not outcome:
            raise ValueError("a verified outcome must be supplied")
        lesson_text = outcome.get("lesson")
        if not isinstance(lesson_text, str) or not lesson_text.strip():
            lesson_text = "Caller-supplied verified outcome."
        lesson = {
            "text": lesson_text,
            "outcome": copy.deepcopy(outcome),
            "speculative": False,
            "organizational_fact": False,
            "verified": True,
        }
        self._lessons.append(lesson)
        return copy.deepcopy(lesson)

    @property
    def lessons(self) -> list[dict]:
        return [copy.deepcopy(row) for row in self._lessons]


def reject_untagged_claim(text: str) -> str:
    """Reject text that is not exactly one labeled claim."""
    if not isinstance(text, str):
        raise UntaggedClaim("claim must be text")
    stripped = text.strip()
    match = _LABEL_RE.match(stripped)
    if not match:
        raise UntaggedClaim("untagged claim")
    body = match.group(2).strip()
    labels = _LABEL_WORD_RE.findall(stripped)
    if len(labels) != 1:
        raise UntaggedClaim("claim must carry exactly one label")
    lowered = body.lower()
    for phrase in FORBIDDEN_PHRASES:
        if phrase in lowered:
            raise UntaggedClaim("invented sentiment or market signal")
    if _STAT_RE.search(body):
        raise UntaggedClaim("manufactured market signal")
    return stripped


def tagged_claim(label: str, body: str, signal: dict | None = None) -> str:
    """Build one labeled claim. Demonstrated text must be caller-supplied."""
    if label not in CLAIM_LABELS:
        raise UntaggedClaim(label)
    if not isinstance(body, str) or not body.strip():
        raise UntaggedClaim("empty claim")
    body = " ".join(body.split())
    if label == "demonstrated":
        supplied = _demonstrated_text(signal)
        if not supplied or body not in supplied:
            raise UntaggedClaim("demonstrated claim is not a supplied demonstration")
    if _forbidden(body, signal):
        raise UntaggedClaim("invented sentiment or market signal")
    if _unsourced_stat(body, signal):
        raise UntaggedClaim("manufactured market signal")
    if _LABEL_WORD_RE.search(body):
        raise UntaggedClaim("claim must carry exactly one label")
    return reject_untagged_claim(f"{label}: {body}")


def propose(signal=None, memory: CreativeMemory | None = None, verified_outcome=None) -> dict:
    """Return OBSERVE / EXPLORE, or a proposal package that stops at the handoff.

    Does not mutate ``signal`` or ``memory``.
    """
    data = _coerce(signal)
    denials = _denials()
    metric = _metric(_outcome_for_metric(verified_outcome, memory))
    envelope = {
        "authority_denials": denials,
        "metric": metric,
        "primary_metric": copy.deepcopy(metric),
        "ledger_written": False,
        "revenue_ledger_written": False,
        "stops_before_execution": True,
    }
    if not _meaningful(data):
        return {
            "mode": "OBSERVE / EXPLORE",
            "proposals": [],
            "handoff": None,
            "futures": {},
            "hypothesis": None,
            "exploration": [],
            "curiosity_queue": [],
            "narratives": [],
            "connections": [],
            "human_context": _closed_human_context(),
            **envelope,
        }

    problem = _problem_text(data)
    failed = _failed_method(data)
    subject = _subject(problem, failed)
    evidence = _evidence(data)
    banned = set(memory.failed_ideas()) if memory is not None else set()
    proposals = _proposals(subject, failed, banned)
    handoff = _handoff(data, problem, evidence, proposals[0]["idea"])
    return {
        "mode": "PROPOSE",
        "proposals": proposals,
        "handoff": handoff,
        "futures": _futures(subject),
        "hypothesis": _hypothesis(subject, evidence),
        "exploration": _exploration(subject, failed),
        "curiosity_queue": _curiosity(subject),
        "narratives": _narratives(data, problem),
        "connections": _connections(subject),
        "experience_question": _experience_question(subject),
        "human_context": _human_context(subject),
        **envelope,
    }


def _coerce(signal):
    if isinstance(signal, dict):
        return copy.deepcopy(signal)
    return None


def _meaningful(signal: dict | None) -> bool:
    if not isinstance(signal, dict) or not signal:
        return False
    if signal.get("meaningful_opportunity") is False:
        return False
    return _problem_text(signal) != ""


def _problem_text(signal: dict) -> str:
    for key in ("problem", "bottleneck", "opportunity"):
        value = signal.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _failed_method(signal: dict) -> str:
    for key in ("failed_method", "failed method"):
        value = signal.get(key)
        if isinstance(value, str):
            return value.strip()
    return ""


def _subject(problem: str, failed: str) -> str:
    text = " ".join(problem.split())
    if failed:
        failed_norm = " ".join(failed.split())
        if failed_norm and failed_norm in text:
            text = text.replace(failed_norm, "the method that already failed")
    return text or "the caller-supplied bottleneck"


def _evidence(signal: dict) -> list:
    if "evidence" in signal:
        raw = signal.get("evidence")
    elif "supporting_evidence" in signal:
        raw = signal.get("supporting_evidence")
    else:
        raw = []
    return _as_list(raw)


def _as_list(raw) -> list:
    if raw is None:
        return []
    if isinstance(raw, str):
        return [raw] if raw.strip() else []
    if isinstance(raw, (list, tuple)):
        return copy.deepcopy(list(raw))
    if isinstance(raw, dict):
        return [copy.deepcopy(raw)]
    return []


def _denials() -> dict[str, str]:
    return {action: "denied" for action in AUTHORITY_ACTIONS}


def _proposals(subject: str, failed: str, banned: set[str]) -> list[dict]:
    rows = []
    used = set(banned)
    if failed:
        used.add(failed)
    for operator in OPERATORS:
        idea, reframed = _idea_for(operator, subject, used, failed)
        used.add(idea)
        rows.append(
            {
                "operator": operator,
                "method": operator,
                "idea": idea,
                "distinct_from_failed_method": idea != failed and failed not in idea,
                "reframed": reframed,
                "testable": True,
            }
        )
    return rows


def _scrub(text: str, failed: str) -> str:
    if failed and failed in text:
        return text.replace(failed, "the prior method")
    return text


def _idea_for(operator: str, subject: str, banned: set[str], failed: str) -> tuple[str, bool]:
    base = _scrub(_IDEA_TEMPLATES[operator].replace("{subject}", subject), failed)
    if base not in banned and base != failed:
        return base, False
    generation = 1
    while True:
        candidate = _scrub(
            (
                f"{operator} reframed {generation}: vary the public wording of {subject} "
                f"by a different check than the recorded failure"
            ),
            failed,
        )
        if candidate not in banned and candidate != failed:
            return candidate, True
        generation += 1


def _handoff(signal: dict, problem: str, evidence: list, idea: str) -> dict:
    why_now = signal.get("why_now")
    if not isinstance(why_now, str) or not why_now.strip():
        why_now = "The caller presented a bottleneck and did not supply a separate timing fact."
    assumptions = _string_list(signal.get("assumptions"))
    assumptions.append(
        "This step assumes the caller-supplied problem text is the bottleneck to vary. That assumption is not verified."
    )
    uncertainties = _string_list(signal.get("uncertainties"))
    uncertainties.append(
        "Whether the bottleneck is still present has not been re-checked by this step."
    )
    handoff = {
        "idea": idea,
        "problem": problem,
        "why_now": why_now.strip(),
        "supporting_evidence": copy.deepcopy(evidence),
        "assumptions": assumptions,
        "uncertainties": uncertainties,
        "expected_value": (
            "The value is a possible cheaper test of the public wording. "
            "This is reasoning, and it is not a cash figure."
        ),
        "potential_downside": (
            "A mistaken proposal could send the Left-Side Brain a low-value review. "
            "No cash movement, message, or release is attached."
        ),
        "experiment": (
            f"Read-only comparison of the public wording of {problem} against the public-offer list. "
            "This step does not run the comparison."
        ),
        "success_criteria": (
            "The comparison shows that the public wording still matches the caller-supplied problem, or that it does not."
        ),
        "reversibility": (
            "Reversible. This handoff does not grant spend, send, deploy, "
            "AgentZ --mode auto, a Founder-law rewrite, a guardrail change, "
            "or an irreversible commitment."
        ),
        "confidence": _confidence(evidence, signal.get("demonstrated")),
    }
    return {key: handoff[key] for key in HANDOFF_FIELDS}


def _string_list(raw) -> list[str]:
    if not isinstance(raw, (list, tuple)):
        return []
    return [item.strip() for item in raw if isinstance(item, str) and item.strip()]


def _confidence(evidence: list, demonstrated) -> float:
    if evidence or _demonstrated_text({"demonstrated": demonstrated}):
        return 0.5
    return 0.25


def _futures(subject: str) -> dict[str, dict[str, str]]:
    rows = {
        "Most likely": {
            "opportunity": f"A small reversible correction can align the public page with the public-offer list for {subject}.",
            "threat": f"The public page can keep showing {subject} while the failed check is repeated.",
            "leading indicators": f"The next independent read still finds the wording of {subject} on the public page.",
            "required capabilities": "A read-only diff between that page and the public-offer list.",
            "potential response": "Hand the diff to the Left-Side Brain and wait for its evaluation.",
        },
        "Best case": {
            "opportunity": f"The diff shows {subject} can leave the public page in one reversible edit.",
            "threat": "A rushed edit could drop a page the public list still needs.",
            "leading indicators": f"The wording of {subject} is absent and the remaining public offers still resolve.",
            "required capabilities": "The same diff, plus a second read of the offers that stay public.",
            "potential response": "Propose that edit for Left-Side review. This step does not apply it.",
        },
        "Worst case": {
            "opportunity": f"The stale public path for {subject} is named before anyone treats a retry as progress.",
            "threat": "Repeating the failed method leaves the public wording in place for another cycle.",
            "leading indicators": "The same failed method runs again and the public wording is unchanged.",
            "required capabilities": "A stop on that method, and one independent read.",
            "potential response": "Mark the retry as a dead end and reframe the question.",
        },
        "Unexpected case": {
            "opportunity": f"The wording of {subject} may sit on a sample page rather than a live catalogue page.",
            "threat": "Treating a sample as live, or a live page as a sample, sends the review the wrong way.",
            "leading indicators": f"The wording of {subject} appears only on a sample route, or it appears on the live host.",
            "required capabilities": "A route-by-route read that separates sample pages from the public catalogue.",
            "potential response": "Split the finding into sample versus live before a correction is proposed.",
        },
        "Disruptive case": {
            "opportunity": f"A confirmed case of {subject} could support a later rule that public pages name only public offers.",
            "threat": "Writing that rule before this case is understood could block an internal flow.",
            "leading indicators": "A second public surface names an offer that is absent from the public list.",
            "required capabilities": "One confirmed case, then a written rule for Left-Side review.",
            "potential response": "Keep this pass on the caller-supplied problem. Hold the broader rule as a hypothesis.",
        },
    }
    return {name: {field: rows[name][field] for field in FUTURE_FIELDS} for name in FUTURES}


def _hypothesis(subject: str, evidence: list) -> dict:
    chain = {
        "Hypothesis": f"A read-only comparison will show whether {subject} is still named on a public surface.",
        "Why it might be true": (
            "The caller supplied this bottleneck. That names a question. "
            "It is not proof the wording is still on the page."
        ),
        "Evidence currently available": copy.deepcopy(evidence),
        "Evidence missing": "An independent read of the public surface and of the public-offer list.",
        "Cheapest useful experiment": (
            f"Diff the public wording of {subject} against the public-offer list without changing either."
        ),
        "Expected result": "The diff shows the wording, or it shows the wording is already gone.",
        "Decision if confirmed": "Ask the Left-Side Brain to evaluate one reversible correction. This step does not apply it.",
        "Decision if rejected": "Return to OBSERVE / EXPLORE. Do not replace the rejected idea with a new offer.",
    }
    return {key: chain[key] for key in HYPOTHESIS_FIELDS}


def _exploration(subject: str, failed: str) -> list[dict]:
    failed_note = failed or "the method the caller did not name"
    notes = {
        "WORTH INVESTIGATING": f"Does an independent read still find {subject} on a public page?",
        "UNKNOWN": "Whether a reader of that page can still open the named path.",
        "ASSUMED": f"Assumed, not shown: the method that already failed is {failed_note}.",
        "KNOWN": "Known only what the caller put in this signal.",
        "NOT WORTH INVESTIGATING": "Inventing a new product name during this pass.",
    }
    rows = [
        {"label": label, "information_value": value, "item": notes[label]}
        for label, value in EXPLORATION_RANK
    ]
    rows.sort(key=lambda row: -row["information_value"])
    return rows


def _curiosity(subject: str) -> list[dict]:
    rows = [
        {
            "Question": f"Does an independent read still find {subject} on a public page?",
            "Potential impact": "Could change whether the next step is a Left-Side review or a return to observation.",
            "Information value": 0.9,
            "Cost to investigate": "One read-only diff. No spend is granted.",
            "Time sensitivity": "Current if the caller is right that the wording is public now. This step has not re-checked that.",
            "Current uncertainty": "The caller report has not been repeated by this step.",
            "Recommended experiment": f"Read-only diff of the public wording of {subject} against the public-offer list.",
        },
        {
            "Question": f"Is the wording of {subject} on a live catalogue page or only on a sample page?",
            "Potential impact": "Could change whether a correction is aimed at a live page or at a sample.",
            "Information value": 0.5,
            "Cost to investigate": "One route-by-route read. No spend is granted.",
            "Time sensitivity": "Useful before a correction is drafted. Not a reason to skip the first read.",
            "Current uncertainty": "The signal does not separate sample pages from live pages.",
            "Recommended experiment": "Read the live host and the sample route separately and record where the wording appears.",
        },
        {
            "Question": "After this one case, is a general public-offer rule worth a separate review?",
            "Potential impact": "Could change a later rule. It should not change the first check.",
            "Information value": 0.2,
            "Cost to investigate": "A written hypothesis after the first case is confirmed. No rule is adopted here.",
            "Time sensitivity": "Low until the first read is done.",
            "Current uncertainty": "One caller report is not a pattern.",
            "Recommended experiment": "Hold the rule as a hypothesis until a second public surface shows the same drift.",
        },
    ]
    rows.sort(key=lambda row: (-row["Information value"], row["Question"]))
    return [{key: row[key] for key in CURIOSITY_FIELDS} for row in rows]


def _narratives(signal: dict, problem: str) -> list[dict]:
    quoted = _quotable_problem(problem, signal)
    shared = {
        "supported": tagged_claim("supported", quoted, signal),
        "aspirational": tagged_claim(
            "aspirational",
            "A later reviewed experiment could make the public page easier to check.",
            signal,
        ),
        "estimated": tagged_claim(
            "estimated",
            "The cheapest check is a single read-only comparison, and this step does not claim that comparison has been run.",
            signal,
        ),
    }
    by_audience = {
        "technical": [shared["supported"], shared["estimated"]],
        "business": [shared["supported"], shared["estimated"]],
        "customer": [
            shared["supported"],
            tagged_claim(
                "aspirational",
                "A clearer public page could be easier to check on a later reviewed experiment.",
                signal,
            ),
        ],
        "investor": [shared["supported"], shared["aspirational"]],
        "founder": [
            tagged_claim(
                "supported",
                "The next decision is whether the Left-Side Brain should evaluate one reversible test.",
                signal,
            ),
            tagged_claim(
                "aspirational",
                "Confirming that test would widen the option set. Rejection would return the question to observation.",
                signal,
            ),
        ],
    }
    demonstrated = _demonstrated_claims(signal)
    if demonstrated:
        by_audience["technical"] = demonstrated + by_audience["technical"]
    narratives = []
    for audience, explanation in AUDIENCES:
        claims = by_audience[audience]
        for claim in claims:
            reject_untagged_claim(claim)
        narratives.append({"audience": audience, "explanation": explanation, "claims": claims})
    return narratives


def _echoes_stat_or_sentiment(text: str) -> bool:
    """True when text cannot be repeated inside a labeled claim.

    Caller-supplied prices, percents, and forbidden phrases stay in the
    problem field. They are not restated as a supported claim.
    """
    lowered = text.lower()
    if any(phrase in lowered for phrase in FORBIDDEN_PHRASES):
        return True
    if _STAT_RE.search(text):
        return True
    if _LABEL_WORD_RE.search(text):
        return True
    return False


def _quotable_problem(problem: str, _signal: dict) -> str:
    candidate = f"The caller-supplied problem is: {problem}"
    if _echoes_stat_or_sentiment(candidate):
        return (
            "The caller supplied a problem statement. "
            "This step does not restate it as sentiment or as a market signal."
        )
    return candidate


def _demonstrated_claims(signal: dict) -> list[str]:
    raw = signal.get("demonstrated")
    texts: list[str] = []
    if isinstance(raw, str) and raw.strip():
        texts.append(" ".join(raw.split()))
    elif isinstance(raw, (list, tuple)):
        texts.extend(" ".join(item.split()) for item in raw if isinstance(item, str) and item.strip())
    claims = []
    for text in texts:
        try:
            claims.append(tagged_claim("demonstrated", text, signal))
        except UntaggedClaim:
            continue
    return claims


def _demonstrated_text(signal: dict | None) -> str:
    if not isinstance(signal, dict):
        return ""
    raw = signal.get("demonstrated")
    if isinstance(raw, str):
        return raw
    if isinstance(raw, (list, tuple)):
        return "\n".join(item for item in raw if isinstance(item, str))
    return ""


def _caller_blob(signal: dict | None) -> str:
    if not isinstance(signal, dict):
        return ""
    parts = []
    for key in (
        "problem",
        "bottleneck",
        "opportunity",
        "evidence",
        "supporting_evidence",
        "demonstrated",
        "quotes",
    ):
        value = signal.get(key)
        if isinstance(value, str):
            parts.append(value)
        elif isinstance(value, (list, tuple)):
            parts.extend(item for item in value if isinstance(item, str))
    return "\n".join(parts).lower()


def _forbidden(text: str, signal: dict | None) -> bool:
    lowered = text.lower()
    supplied = _caller_blob(signal)
    for phrase in FORBIDDEN_PHRASES:
        if phrase in lowered and phrase not in supplied:
            return True
    return False


def _unsourced_stat(text: str, signal: dict | None) -> bool:
    supplied = _caller_blob(signal)
    for match in _STAT_RE.finditer(text):
        if match.group(0).lower() not in supplied:
            return True
    return False


def _connections(subject: str) -> list[dict]:
    return [
        {
            "relation": "similarities",
            "status": "hypothesis",
            "note": f"Hypothesis, not a fact: another public page may repeat the wording of {subject}.",
        },
        {
            "relation": "analogies",
            "status": "hypothesis",
            "note": "Hypothesis, not a fact: listing an internal record on a public page behaves like an unfiltered inventory.",
        },
        {
            "relation": "recurring patterns",
            "status": "hypothesis",
            "note": f"Hypothesis, not a fact: {subject} may be one case of a public page naming a non-public offer.",
        },
        {
            "relation": "hidden relationships",
            "status": "hypothesis",
            "note": "Hypothesis, not a fact: the page and the public-offer list may disagree.",
        },
        {
            "relation": "weak signals",
            "status": "hypothesis",
            "note": "Hypothesis, not a fact: one caller report is a weak signal until an independent read repeats it.",
        },
        {
            "relation": "second-order effects",
            "status": "hypothesis",
            "note": "Hypothesis, not a fact: leaving the wording up could train readers to treat every internal record as public.",
        },
        {
            "relation": "unexpected combinations",
            "status": "hypothesis",
            "note": f"Hypothesis, not a fact: a sample page and a live page could both carry {subject} for different reasons.",
        },
    ]


def _experience_question(subject: str) -> str:
    return (
        f"What public change would make {subject} easier to check, more useful as a record, "
        "or more trustworthy to re-check? The question is not a claim about a person's preference."
    )


def _closed_human_context() -> dict:
    context: dict = {
        factor: {
            "uncertainty": "explicit",
            "possibility": "No opportunity is open, so this step makes no reading of this factor.",
        }
        for factor in HUMAN_FACTORS
    }
    context["customer_sentiment"] = None
    context["internal_thoughts"] = None
    return context


def _human_context(subject: str) -> dict:
    context: dict = {
        factor: {
            "uncertainty": "explicit",
            "possibility": (
                f"Possible effect to test, not a known fact: {factor} may change whether a "
                f"Left-Side review of {subject} is worth opening. This step does not know that it does."
            ),
        }
        for factor in HUMAN_FACTORS
    }
    context["customer_sentiment"] = None
    context["internal_thoughts"] = None
    return context


def _outcome_for_metric(verified_outcome, memory: CreativeMemory | None):
    if isinstance(verified_outcome, dict):
        return verified_outcome
    if memory is not None and memory.lessons:
        latest = memory.lessons[-1].get("outcome")
        if isinstance(latest, dict):
            return latest
    return None


def _metric(outcome) -> dict:
    metric = {
        "name": PRIMARY_METRIC,
        "verified_value": None,
        "cash": None,
    }
    if not isinstance(outcome, dict):
        return metric
    if outcome.get("previously_unknown") is True and "value" in outcome:
        metric["verified_value"] = outcome["value"]
    if outcome.get("previously_unknown") is True and "cash" in outcome:
        metric["cash"] = outcome["cash"]
    return metric
