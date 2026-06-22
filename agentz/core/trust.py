"""
agentz.core.trust
-----------------
Trust Agent: Computes authenticity scores and detects counterfeit patterns.
Enhanced with Geospatial Anomaly Detection (Phase 19).
"""
from __future__ import annotations
import logging
from typing import List, Dict, Any

logger = logging.getLogger("agentz.trust")

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
        
    # Verification failures
    if not scan_history.get("signature_valid", True):
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
        logger.error(f"Geospatial check failed for {qron_id}: {e}")
        return {"anomaly": False, "reason": f"Check error: {e}"}

async def monitor_scans(supabase, product_id: str) -> float:
    """
    Analyzes recent scans and updates the product's authenticity score and timeline.
    """
    # 0. Fetch qron_id from product
    product_res = supabase.table("products").select("qron_id, metadata, authenticity_score").eq("id", product_id).single().execute()
    product = product_res.data
    if not product: return 0.0

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
    
    if geo_check["anomaly"]:
        logger.warning("Geo-Anomaly detected for product %s", product_id)
        product_metadata["security_flag"] = "geo_anomaly"
        product_metadata["geo_alert"] = geo_check["reason"]
        score = max(0.0, score - 25.0)

    # 3. Velocity & Pattern Logic
    velocity = len(scans) 
    mock_history = {"velocity": velocity, "duplicate_regions": 0, "signature_valid": True}
    base_score = calculate_authenticity(mock_history)
    
    # Combined score (floor at 0)
    final_score = min(score, base_score)

    # 4. Update Timeline in Metadata
    if "timeline" not in product_metadata:
        product_metadata["timeline"] = [
            {"event": "Identity Created", "status": "complete", "timestamp": "Initial"}
        ]
        
    # Append latest scan if new
    if scans:
        latest_scan = scans[0]
        scan_event = {
            "event": "Verified Scan",
            "location": f"{latest_scan.get('city', 'Unknown')}, {latest_scan.get('country', '??')}",
            "timestamp": latest_scan.get("scanned_at"),
            "status": "complete"
        }
        if not any(e.get("timestamp") == scan_event["timestamp"] for e in product_metadata["timeline"]):
            product_metadata["timeline"].append(scan_event)
    
    # 5. Finalize product update
    supabase.table("products").update({
        "authenticity_score": final_score,
        "metadata": product_metadata
    }).eq("id", product_id).execute()
    
    return final_score
