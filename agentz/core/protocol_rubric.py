# AgentZ port of AI Adapt research build 2026-10-14 ProRubric (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-14-prorubric-protocol-gate.md
"""ProRubric-style protocol-level gate (reimplemented from arXiv:2609.38847 aggregation idea).

Additive rubric scoring lets criteria compensate for each other: a record can miss
the one check that matters and still score high. Protocol-level aggregation groups
criteria into dimensions; a dimension counts ONLY when every criterion holds AND its
failure clause does not fire. Grouping is static config; the judge is pluggable
(deterministic checks, or an LLM callable that is mocked in tests).
"""
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional
import hashlib, json

Judge = Callable[[str, dict], bool]  # (criterion_id, record) -> holds?

@dataclass
class Dimension:
    name: str
    criteria: List[str]
    failure_clause: Optional[str] = None   # criterion id that, if it HOLDS, voids the dimension
    weight: float = 1.0

@dataclass
class Verdict:
    additive_score: float
    protocol_score: float
    dimensions: Dict[str, bool]
    failed_criteria: Dict[str, List[str]]
    fired_failure_clauses: List[str]
    approved: bool
    receipt_sha256: str = ""

def evaluate(record: dict, dims: List[Dimension], judge: Judge, threshold: float = 1.0) -> Verdict:
    all_c, held = [], 0
    dim_ok, failed, fired = {}, {}, []
    for d in dims:
        miss = []
        for c in d.criteria:
            ok = bool(judge(c, record))
            all_c.append(c); held += ok
            if not ok: miss.append(c)
        clause = bool(d.failure_clause and judge(d.failure_clause, record))
        if clause: fired.append(d.failure_clause)
        dim_ok[d.name] = not miss and not clause
        if miss: failed[d.name] = miss
    additive = held / len(all_c) if all_c else 0.0
    tw = sum(d.weight for d in dims) or 1.0
    protocol = sum(d.weight for d in dims if dim_ok[d.name]) / tw
    v = Verdict(round(additive, 4), round(protocol, 4), dim_ok, failed, fired, protocol >= threshold)
    payload = json.dumps({"record": record, "dims": dim_ok, "protocol": v.protocol_score}, sort_keys=True, default=str)
    v.receipt_sha256 = hashlib.sha256(payload.encode()).hexdigest()
    return v

# --- Example config: EU Battery Passport readiness (illustrative field names, not the official schema) ---
def _present(k): return lambda r: r.get(k) not in (None, "", [])
BATTERY_CHECKS: Dict[str, Callable[[dict], bool]] = {
    "has_battery_id": _present("battery_id"),
    "has_manufacturer": _present("manufacturer"),
    "has_carbon_footprint": _present("carbon_footprint_kgco2e"),
    "carbon_source_cited": _present("carbon_footprint_source"),
    "has_recycled_content": _present("recycled_content_pct"),
    "recycled_in_range": lambda r: isinstance(r.get("recycled_content_pct"), (int, float)) and 0 <= r["recycled_content_pct"] <= 100,
    "chemistry_declared": _present("chemistry"),
    "signature_present": _present("issuer_signature"),
    # failure clause: an explicit contradiction voids the dimension even if fields exist
    "FAIL_self_attested_only": lambda r: r.get("carbon_footprint_source") == "self-attested",
}
BATTERY_DIMS = [
    Dimension("identity", ["has_battery_id", "has_manufacturer", "signature_present"]),
    Dimension("carbon", ["has_carbon_footprint", "carbon_source_cited"], failure_clause="FAIL_self_attested_only"),
    Dimension("materials", ["has_recycled_content", "recycled_in_range", "chemistry_declared"]),
]
def rule_judge(checks): return lambda c, r: checks[c](r)

def llm_judge(call_llm: Callable[[str], str]) -> Judge:
    """Wrap an LLM (Claude via API) as a binary per-criterion judge. Network call injected."""
    def j(criterion, record):
        out = call_llm(f"Criterion: {criterion}\nRecord: {json.dumps(record, sort_keys=True)}\nAnswer YES or NO only.")
        return out.strip().upper().startswith("YES")
    return j
