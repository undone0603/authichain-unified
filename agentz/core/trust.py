"""
agentz.core.trust
-----------------
Trust Agent: Computes authenticity scores and detects counterfeit patterns.
Enhanced with Geospatial Anomaly Detection (Phase 19).
"""
from __future__ import annotations
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("agentz.trust")

# Anything above this, with every check actually run and passed, is "verified".
VERIFIED_THRESHOLD = 90.0

def calculate_authenticity(scan_history: Dict[str, Any]) -> float:
    """
    Computes an authenticity score (0-100) based on scan history and patterns.
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

async def detect_geospatial_anomalies(supabase, qron_id: int, expected_region: str = "US") -> Dict[str, Any]:
    """
    Analyzes scan locations for a product to detect unauthorized distribution or counterfeiting.
    """
    try:
        res = supabase.table("scan_events").select("city, country").eq("qron_id", qron_id).execute()
        scans = res.data or []
        
        if len(scans) < 3:
            return {"anomaly": False, "reason": "Insufficient data"}
            
        # Count unexpected regions
        anomalous_scans = [s for s in scans if s.get("country") != expected_region]
        
        if len(anomalous_scans) >= 3:
            return {
                "anomaly": True, 
                "reason": f"Detected {len(anomalous_scans)} scans outside {expected_region}",
                "count": len(anomalous_scans)
            }
            
        return {"anomaly": False, "reason": "Locations within expected range"}
    except Exception as e:
        # A check that did not run is not a clean result. Report it as an
        # error so callers cannot read it as "no anomaly".
        logger.error(f"Geospatial check failed for {qron_id}: {e}")
        return {"anomaly": None, "error": True, "reason": f"Check error: {e}"}

async def assess_scans(
    supabase, product_id: str, signature_valid: Optional[bool] = None
) -> Dict[str, Any]:
    """
    Analyzes recent scans, updates the product's authenticity score and
    timeline, and reports which checks actually ran.

    `signature_valid` is the result of a real signature check done by the
    caller, or None when no check was done. It is never assumed: a scan is
    only "verified" when the signature was checked and valid, the location
    check ran without error, and the score clears VERIFIED_THRESHOLD.
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
    # Default to US for pilot, but in production this would be set in product metadata
    target_market = product_metadata.get("target_market", "US")
    geo_check = await detect_geospatial_anomalies(supabase, qron_id, expected_region=target_market)

    if geo_check.get("error"):
        geo_status = "error"
    elif geo_check["anomaly"]:
        geo_status = "anomaly"
        logger.warning("geo_anomaly flag set for product")
        product_metadata["security_flag"] = "geo_anomaly"
        product_metadata["geo_alert"] = geo_check["reason"]
        score = max(0.0, score - 25.0)
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

    verified = (
        signature_status == "valid"
        and geo_status == "clear"
        and final_score > VERIFIED_THRESHOLD
    )

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
        },
    }


async def monitor_scans(supabase, product_id: str) -> float:
    """
    Score-only wrapper over assess_scans for the workflow handlers. Never use
    the returned number alone as a verification verdict.
    """
    result = await assess_scans(supabase, product_id)
    return result["score"]
