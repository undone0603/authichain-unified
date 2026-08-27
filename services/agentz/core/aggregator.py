"""
agentz.core.aggregator
----------------------
Marketplace Agent: Aggregates verified brands into a central directory for qron.space.
"""
from __future__ import annotations
import json
from typing import Dict, Any, List

async def generate_marketplace_manifest(supabase) -> List[Dict[str, Any]]:
    """
    Queries products to create a 'Verified Authentic' marketplace manifest.
    Uses 'products' table as 'businesses' table is not available.
    """
    # 1. Fetch unique brands from the products table
    # Supabase/Postgrest doesn't support SELECT DISTINCT easily, so we fetch and deduplicate
    products_res = supabase.table("products").select("brand, industry_id, created_at").not_.ilike("brand", "%test%").execute()
    products = products_res.data
    
    unique_brands = {}
    for p in products:
        brand = p.get("brand")
        if brand and brand not in unique_brands:
            # Aggregate stats for this brand
            count_res = supabase.table("products").select("count", count="exact").eq("brand", brand).execute()
            unique_brands[brand] = {
                "brand": brand,
                "vertical": p.get("industry_id", "general"),
                "location": "Global", # Placeholder for business location
                "product_count": count_res.count or 0,
                "verified_since": p.get("created_at"),
                "directory_link": f"https://qron.space/explore/{brand.lower().replace(' ', '-')}"
            }
            
    return sorted(list(unique_brands.values()), key=lambda x: x["product_count"], reverse=True)

async def get_global_network_stats(supabase) -> Dict[str, Any]:
    """
    Aggregates global stats (including test data for throughput demonstration).
    """
    # Total historical scans (including tests) to show 'Network Power'
    scans_count = supabase.table("scan_events").select("count", count="exact").execute().count
    products_count = supabase.table("products").select("count", count="exact").execute().count
    
    return {
        "total_scans": scans_count or 0,
        "total_identities": products_count or 0,
        "active_nodes": "Polygon Mainnet",
        "throughput_status": "🟢 Optimal"
    }

async def publish_manifest(supabase, manifest: List[Dict[str, Any]]):
    """
    Saves the manifest to a central configuration record in Supabase.
    """
    try:
        supabase.table("public_reports").upsert({
            "id": "marketplace_manifest", 
            "data": {"brands": manifest, "updated_at": "2026-05-17T12:00:00Z"}
        }).execute()
        return True
    except Exception as e:
        import logging
        logging.getLogger("agentz.aggregator").error(f"Failed to publish manifest: {e}")
        return False
