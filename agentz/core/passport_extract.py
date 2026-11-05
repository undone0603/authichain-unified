# AgentZ port of AI Adapt research build 2026-10-21 Clairic passport extraction (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-21-clairic-battery-passport-extraction.md
"""passport_extract — typed Battery Passport field extraction with Clairic.

Calls Cloudflare's Clairic extraction model (Workers AI preview, announced
2026-10-19, blog.cloudflare.com/clairic-extraction-model) to pull typed values
with confidence and character spans out of supplier documents, then triages
every field into ACCEPT / REVIEW / MISSING and seals the accepted set with a
SHA-256 provenance receipt for the AuthiChain ledger.

Request/response shapes follow the code samples in Cloudflare's launch post
(state + fields -> answers{value, guess, confidence, p_null, span}). The REST
wrapper path is the standard Workers AI one and is NOT yet verified for this
model. Weights are not released; this module only calls the hosted API.

Field list is an illustrative subset modelled on public Battery Passport
attributes (Reg. (EU) 2023/1542 Annex XIII). Verify names against the
official data model before production.
"""
from __future__ import annotations
import hashlib, json, urllib.request
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional

MODEL = "@cf/cloudflare/clairic"
ACCEPT, REVIEW, MISSING = "ACCEPT", "REVIEW", "MISSING"

# name -> (clairic field spec, required, (min, max) plausibility range or None)
BATTERY_FIELDS: Dict[str, tuple] = {
    "manufacturer_name": ({"type": "text", "instructions": "Legal name of the battery manufacturer"}, True, None),
    "manufacturing_date": ({"type": "date", "instructions": "Date the battery was manufactured"}, True, None),
    "battery_chemistry": ({"type": "text", "instructions": "Cell chemistry, e.g. NMC811, LFP"}, True, None),
    "rated_capacity_ah": ({"type": "number", "decimals": 1, "unit": "Ah", "instructions": "Rated capacity"}, True, (0.1, 2000)),
    "nominal_voltage_v": ({"type": "number", "decimals": 1, "unit": "V", "instructions": "Nominal voltage"}, True, (1, 1500)),
    "weight_kg": ({"type": "number", "decimals": 1, "unit": "kg", "instructions": "Battery weight"}, True, (0.01, 5000)),
    "carbon_footprint_kgco2e_per_kwh": ({"type": "number", "decimals": 1, "unit": "kgCO2e/kWh",
                                         "instructions": "Carbon footprint per kWh of total energy over life"}, True, (1, 500)),
    "recycled_cobalt_pct": ({"type": "number", "decimals": 1, "unit": "%", "instructions": "Recycled cobalt share"}, False, (0, 100)),
    "recycled_lithium_pct": ({"type": "number", "decimals": 1, "unit": "%", "instructions": "Recycled lithium share"}, False, (0, 100)),
    "recycled_nickel_pct": ({"type": "number", "decimals": 1, "unit": "%", "instructions": "Recycled nickel share"}, False, (0, 100)),
    "expected_lifetime_cycles": ({"type": "number", "integer": True, "instructions": "Expected lifetime in full charge cycles"}, False, (1, 100000)),
}

Transport = Callable[[dict], dict]   # payload -> raw JSON response


def build_request(document_text: str, fields: Dict[str, tuple] = BATTERY_FIELDS) -> dict:
    return {"state": document_text, "fields": {k: dict(v[0]) for k, v in fields.items()}}


def rest_transport(account_id: str, api_token: str, timeout: float = 30.0) -> Transport:
    """Workers AI REST transport (path unverified for Clairic — test before relying on it)."""
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{MODEL}"

    def _send(payload: dict) -> dict:
        req = urllib.request.Request(url, data=json.dumps(payload).encode(), method="POST",
                                     headers={"Authorization": f"Bearer {api_token}",
                                              "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    return _send


def unwrap_answers(raw: dict) -> dict:
    """Accept {answers}, {result:{answers}} (REST envelope) or a bare answers map."""
    if not isinstance(raw, dict):
        raise ValueError("response is not a JSON object")
    if isinstance(raw.get("result"), dict):
        raw = raw["result"]
    if isinstance(raw.get("answers"), dict):
        return raw["answers"]
    if raw and all(isinstance(v, dict) and "type" in v for v in raw.values()):
        return raw
    raise ValueError("no answers in response")


@dataclass
class FieldResult:
    name: str
    status: str
    value: object = None
    confidence: Optional[float] = None
    evidence: Optional[str] = None      # exact source substring from span, for audit
    reasons: List[str] = field(default_factory=list)


@dataclass
class PassportDraft:
    fields: Dict[str, FieldResult]
    source_sha256: str
    accepted_sha256: str
    complete: bool                      # every required field ACCEPTed

    def summary(self) -> Dict[str, int]:
        out = {ACCEPT: 0, REVIEW: 0, MISSING: 0}
        for f in self.fields.values():
            out[f.status] += 1
        return out


def _evidence(doc: str, span) -> Optional[str]:
    if isinstance(span, (list, tuple)) and len(span) == 2 and all(isinstance(i, int) for i in span):
        a, b = span
        if 0 <= a < b <= len(doc):
            return doc[a:b]
    return None


def triage(doc: str, answers: dict, fields: Dict[str, tuple] = BATTERY_FIELDS,
           min_conf: float = 0.95, max_p_null: float = 0.5) -> PassportDraft:
    results: Dict[str, FieldResult] = {}
    for name, (spec, required, rng) in fields.items():
        a = answers.get(name)
        if not isinstance(a, dict):
            results[name] = FieldResult(name, MISSING, reasons=["no answer returned"]); continue
        value, conf, p_null = a.get("value"), a.get("confidence"), a.get("p_null", 0.0)
        ev = _evidence(doc, a.get("span"))
        r = FieldResult(name, ACCEPT, value, conf, ev)
        if value is None or (p_null is not None and p_null >= max_p_null):
            r.status, r.value = MISSING, None
            r.reasons.append(f"model says absent (p_null={p_null})")
            if a.get("guess") is not None:
                r.reasons.append(f"unused guess={a.get('guess')!r}")
        else:
            if conf is None or conf < min_conf:
                r.status = REVIEW; r.reasons.append(f"confidence {conf} < {min_conf}")
            if rng and isinstance(value, (int, float)) and not (rng[0] <= value <= rng[1]):
                r.status = REVIEW; r.reasons.append(f"value {value} outside plausible range {rng}")
            if spec["type"] == "text" and ev is None:
                r.status = REVIEW; r.reasons.append("text value has no verifiable source span")
            if spec["type"] == "text" and ev is not None and str(value) not in ev and ev not in str(value):
                r.status = REVIEW; r.reasons.append("value does not match quoted span")
        results[name] = r
    _cross_checks(results)
    accepted = {k: v.value for k, v in sorted(results.items()) if v.status == ACCEPT}
    complete = all(results[k].status == ACCEPT for k, (_, req, _) in fields.items() if req)
    return PassportDraft(
        fields=results,
        source_sha256=hashlib.sha256(doc.encode()).hexdigest(),
        accepted_sha256=hashlib.sha256(json.dumps(accepted, sort_keys=True, default=str).encode()).hexdigest(),
        complete=complete)


def _cross_checks(res: Dict[str, FieldResult]) -> None:
    pcts = [res[k] for k in ("recycled_cobalt_pct", "recycled_lithium_pct", "recycled_nickel_pct") if k in res]
    for f in pcts:
        if f.status == ACCEPT and isinstance(f.value, (int, float)) and f.value > 0 and f.value < 1:
            f.status = REVIEW; f.reasons.append("share below 1% — check whether source gave a fraction, not a percent")


def extract(doc: str, transport: Transport, **kw) -> PassportDraft:
    return triage(doc, unwrap_answers(transport(build_request(doc))), **kw)


def ledger_receipt(d: PassportDraft, battery_id: str) -> dict:
    """Small payload for an AuthiChain provenance anchor."""
    return {"battery_id": battery_id, "model": MODEL, "source_sha256": d.source_sha256,
            "accepted_sha256": d.accepted_sha256, "complete": d.complete, "counts": d.summary(),
            "review": sorted(k for k, f in d.fields.items() if f.status == REVIEW),
            "missing": sorted(k for k, f in d.fields.items() if f.status == MISSING)}
