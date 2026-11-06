"""
agentz.core.trust
-----------------
Trust Agent: Computes scan heuristics only; not physical authenticity.
Enhanced with Geospatial Anomaly Detection (Phase 19).
"""
from __future__ import annotations
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("agentz.trust")

# Historical heuristic threshold, never an authenticity or authorization gate.
VERIFIED_THRESHOLD = 90.0

def calculate_authenticity(scan_history: Dict[str, Any]) -> float:
    """
    Computes a risk heuristic (0-100) from incomplete scan observations.
    """
    score = 100.0
    
    # Velocity check: Too many scans in a short time
    velocity = scan_history.get("velocity", 0)
    if velocity > 10: # e.g., 10 scans per hour
        score -= 40
        
    # Geographic collision: Scans from distant regions in impossible timeframes
    if scan_history.get("duplicate_regions", 0) > 3:
        score -= 25
        
    # Verification failures. An absent key means no check ran; the score is
    # a risk heuristic, and assess_scans() is what refuses to call an
    # unchecked scan verified.
    if scan_history.get("signature_valid") is False:
        score = 0
        
    return max(score, 0.0)

async def detect_geospatial_anomalies(supabase, qron_id: int, expected_region: Optional[str] = None) -> Dict[str, Any]:
    """Return a review heuristic, never physical authenticity proof.

    Missing market/country data means the check is unknown, not clear and not
    evidence of counterfeiting. Scan locations are caller-controlled metadata.
    """
    if not isinstance(expected_region, str) or not expected_region.strip():
        return {"anomaly": None, "checked": False, "reason": "Target market not configured"}
    expected = expected_region.strip().casefold()
    try:
        res = supabase.table("scan_events").select("city, country").eq("qron_id", qron_id).execute()
        scans = res.data
        if not isinstance(scans, list) or len(scans) < 3:
            return {"anomaly": None, "checked": False, "reason": "Insufficient location observations"}
        countries = []
        for scan in scans:
            country = scan.get("country") if isinstance(scan, dict) else None
            if not isinstance(country, str) or not country.strip():
                return {"anomaly": None, "checked": False, "reason": "Incomplete country observations"}
            countries.append(country.strip().casefold())
        unexpected = sum(country != expected for country in countries)
        if unexpected >= 3:
            return {"anomaly": True, "checked": True,
                    "reason": f"Observed {unexpected} scans outside configured region",
                    "count": unexpected}
        return {"anomaly": False, "checked": True, "reason": "No multi-scan region anomaly in observations"}
    except Exception as e:
        # A check that did not run is not a clean result. Report it as an
        # error so callers cannot read it as "no anomaly".
        # Storage/SDK exceptions can include sensitive query or credential
        # details. Keep the raw exception out of logs and API-visible results.
        logger.error("Geospatial scan check unavailable; evidence coverage unknown")
        return {"anomaly": None, "error": True, "reason": "Geospatial data unavailable"}

async def assess_scans(
    supabase, product_id: str, signature_valid: Optional[bool] = None
) -> Dict[str, Any]:
    """
    Analyzes recent scans, updates the product's authenticity score and
    timeline, and reports which checks actually ran.

    `signature_valid` is the result of a real signature check done by the
    caller, or None when no check was done. It is never assumed: a scan is
    not "verified" merely because a signature and location heuristic pass.
    Canonical issuer trust, current lifecycle/revocation, and physical binding
    are not established by this legacy endpoint.
    """
    # 0. Fetch qron_id from product
    product_res = supabase.table("products").select("qron_id, metadata, authenticity_score").eq("id", product_id).single().execute()
    product = product_res.data
    if not product:
        return {
            "score": 0.0,
            "verified": False,
            "checks": {"product": "not_found"},
        }

    qron_id = product.get("qron_id")
    product_metadata = product.get("metadata", {})
    score = float(product.get("authenticity_score", 100.0))

    # 1. Fetch recent scans using qron_id
    scans_res = supabase.table("scan_events").select("*").eq("qron_id", qron_id).order("scanned_at", desc=True).limit(10).execute()
    scans = scans_res.data

    # 2. Geospatial Anomaly Pass (Phase 19)
    # Do not invent a product's intended market from missing metadata.
    target_market = product_metadata.get("target_market")
    geo_check = await detect_geospatial_anomalies(supabase, qron_id, expected_region=target_market)

    if geo_check.get("error"):
        geo_status = "error"
    elif geo_check.get("checked") is not True:
        geo_status = "unknown"
    elif geo_check["anomaly"]:
        geo_status = "anomaly"
        # A location heuristic is not proof of illegitimate goods, and should
        # not impose a persistent security flag or authenticity penalty.
        logger.warning("Geospatial review candidate; no counterfeit verdict")
    else:
        geo_status = "clear"

    # 3. Velocity & Pattern Logic. The signature only enters the score when a
    # real check produced it; an unchecked signature is not a valid one.
    velocity = len(scans)
    history: Dict[str, Any] = {"velocity": velocity, "duplicate_regions": 0}
    if signature_valid is not None:
        history["signature_valid"] = signature_valid
    base_score = calculate_authenticity(history)

    # Combined score (floor at 0)
    final_score = min(score, base_score)

    if signature_valid is None:
        signature_status = "not_checked"
    else:
        signature_status = "valid" if signature_valid else "invalid"

    # A trusted offline signature + a location heuristic cannot establish
    # current issuer authorization, revocation status, on-chain anchoring, or
    # physical-world product binding. Until the canonical verifier checks all
    # required conditions, this legacy scan endpoint must fail closed.
    verified = False

    # 4. Update Timeline in Metadata
    if "timeline" not in product_metadata:
        product_metadata["timeline"] = [
            {"event": "Identity Created", "status": "complete", "timestamp": "Initial"}
        ]

    # Append latest scan if new, labelled with what was actually established.
    if scans:
        latest_scan = scans[0]
        scan_event = {
            "event": "Verified Scan" if verified else "Unverified Scan",
            "location": f"{latest_scan.get('city', 'Unknown')}, {latest_scan.get('country', '??')}",
            "timestamp": latest_scan.get("scanned_at"),
            "status": "complete",
            "signature": signature_status,
            "location_check": geo_status,
        }
        if not any(e.get("timestamp") == scan_event["timestamp"] for e in product_metadata["timeline"]):
            product_metadata["timeline"].append(scan_event)

    # 5. Finalize product update
    supabase.table("products").update({
        "authenticity_score": final_score,
        "metadata": product_metadata
    }).eq("id", product_id).execute()

    return {
        "score": final_score,
        "verified": verified,
        "checks": {
            "signature": signature_status,
            "location": geo_status,
            "velocity": velocity,
            "canonical_registry": "not_checked",
        },
    }


async def monitor_scans(supabase, product_id: str) -> float:
    """
    Score-only wrapper over assess_scans for the workflow handlers. Never use
    the returned number alone as a verification verdict.
    """
    result = await assess_scans(supabase, product_id)
    return result["score"]
