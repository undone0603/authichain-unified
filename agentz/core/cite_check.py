# AgentZ port of AI Adapt research build 2026-10-31 CiteCheck (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-31-citecheck-evidence-gate.md
"""CiteCheck — evidence-bound claim gate for agents.

Reimplemented from the method described in ABF-Bench (arXiv:2610.23656):
every claim an agent makes must cite records the agent actually retrieved.
No code from the paper is used (none was released).

A run produces:
  trace  : list of retrieval events {"record_id", "content"} the harness logged
  claims : list of {"claim_id", "text", "cites": [{"record_id", "quote", "sha256"?}]}

Verdicts per claim:
  SUPPORTED     every cite was retrieved, quote found in content, hash matches
  UNRETRIEVED   cites a record the agent never fetched (overconfidence)
  QUOTE_MISS    record fetched, but the quoted span is not in it
  HASH_MISMATCH declared sha256 differs from the retrieved content
  UNCITED       no citations at all
"""
import hashlib
import json
from dataclasses import dataclass, field, asdict

SUPPORTED = "SUPPORTED"
UNRETRIEVED = "UNRETRIEVED"
QUOTE_MISS = "QUOTE_MISS"
HASH_MISMATCH = "HASH_MISMATCH"
UNCITED = "UNCITED"
_SEVERITY = [UNCITED, UNRETRIEVED, HASH_MISMATCH, QUOTE_MISS, SUPPORTED]


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _norm(s: str) -> str:
    return " ".join(s.split()).lower()


@dataclass
class ClaimResult:
    claim_id: str
    verdict: str
    problems: list = field(default_factory=list)


@dataclass
class Report:
    results: list
    supported: int
    total: int
    gate: str  # "pass" | "fail"

    @property
    def support_rate(self) -> float:
        return self.supported / self.total if self.total else 0.0

    def to_json(self) -> str:
        d = asdict(self)
        d["support_rate"] = round(self.support_rate, 4)
        return json.dumps(d, sort_keys=True)


def index_trace(trace):
    idx = {}
    for ev in trace:
        rid = ev["record_id"]
        idx.setdefault(rid, []).append(ev["content"])
    return idx


def check_claim(claim, idx) -> ClaimResult:
    cites = claim.get("cites") or []
    if not cites:
        return ClaimResult(claim["claim_id"], UNCITED, ["no citations"])
    worst = SUPPORTED
    problems = []
    for c in cites:
        rid = c["record_id"]
        if rid not in idx:
            v = UNRETRIEVED
            problems.append(f"{rid}: never retrieved")
        else:
            contents = idx[rid]
            declared = c.get("sha256")
            if declared and declared not in {sha256(x) for x in contents}:
                v = HASH_MISMATCH
                problems.append(f"{rid}: sha256 mismatch")
            elif c.get("quote") and not any(_norm(c["quote"]) in _norm(x) for x in contents):
                v = QUOTE_MISS
                problems.append(f"{rid}: quote not found")
            else:
                v = SUPPORTED
        if _SEVERITY.index(v) < _SEVERITY.index(worst):
            worst = v
    return ClaimResult(claim["claim_id"], worst, problems)


def check(trace, claims, min_support=1.0) -> Report:
    idx = index_trace(trace)
    results = [check_claim(c, idx) for c in claims]
    sup = sum(r.verdict == SUPPORTED for r in results)
    rate = sup / len(results) if results else 0.0
    gate = "pass" if results and rate >= min_support else "fail"
    return Report(results, sup, len(results), gate)


class RecordingRetriever:
    """Wrap any fetch(record_id)->str so every retrieval lands in the trace."""

    def __init__(self, fetch):
        self._fetch = fetch
        self.trace = []

    def __call__(self, record_id):
        content = self._fetch(record_id)
        self.trace.append({"record_id": record_id, "content": content})
        return content
