"""
agentz.core.pages
-----------------
Manages the "Living Product Page" metadata and interactive components.
"""
from __future__ import annotations
from typing import Dict, Any
def generate_living_page_config(product_data: Dict[str, Any], qr_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generates the configuration for a Living Product Page,
    incorporating all components from the strategic blueprint.
    """
    metadata = product_data.get("metadata", {})
    industry = product_data.get("industry_id")
    scan_count = metadata.get("scan_count", 0)

    config = {
        "authenticity": {
            "score": product_data.get("authenticity_score", 100),
            "status": "Verified" if product_data.get("authenticity_score", 100) > 90 else "Review Required",
            "verification_id": qr_data.get("id"),
            "nfc_id": metadata.get("nfc_id", "Not Enabled"),
            "security_level": "NFC Hardened" if metadata.get("nfc_enabled") else "Standard QR",
            "blockchain_anchor": product_data.get("tx_hash", "Pending Anchor")
        },
        "supply_chain": {
            "timeline": metadata.get("timeline", [
                {"event": "Manufactured", "status": "complete"},
                {"event": "Identity Created", "status": "complete"}
            ])
        },
        "storymode": {
            "video_url": product_data.get("story_video_url"),
            "narration": metadata.get("narration_script", "Story loading..."),
            "chapters": {
                "active_chapter": 1 if scan_count < 5 else 2,
                "unlock_progress": f"{scan_count}/5 scans to unlock Chapter 2: 'Behind the Scenes'"
            }
        },
        "concierge": {
            "enabled": True,
            "welcome_message": f"Hi! I'm your {product_data.get('name')} Concierge. How can I help you today?"
        },
        "rewards": {
            "token": "QRON",
            "base_reward": 10,
            "quest": "Scan 3 more times to unlock 'Local Supporter' badge",
            "redemption_url": f"https://qron.space/redeem/{qr_data.get('id')}",
            "burn_options": [
                {"qron": 50, "discount": "$5.00", "label": "Community Supporter Tier"},
                {"qron": 100, "discount": "$12.00", "label": "Authentic Advocate Tier"}
            ]
        },
        "merchant": {
            "cta": f"Visit {product_data.get('brand')} for more",
            "link": f"https://authichain.com/merchant/{product_data.get('brand','').lower().replace(' ', '-')}"
        },
        "social": {
            "share_text": f"Just verified the authenticity of {product_data.get('name')}! #AuthiChain #QRON"
        }
    }
    
    # StrainChain Customization
    if industry == "cannabis":
        config["cannabis_metrics"] = {
            "thc": metadata.get("thc_content"),
            "terpenes": metadata.get("terpene_profile"),
            "lab_verification": metadata.get("lab_results_url"),
            "is_golden_batch": metadata.get("is_golden_batch", False),
            "scarcity_status": f"Limited: 1 of {metadata.get('scarcity')}" if metadata.get("scarcity") else "Standard Release"
        }
        config["storymode"]["grower_story"] = metadata.get("grower_story")
        config["storymode"]["somatic_guide"] = metadata.get("somatic_summary")
        config["merchant"]["cta"] = "Find Near Me (Licensed Dispensary)"
        
    return config

async def publish_living_page(supabase, product_id: str, config: Dict[str, Any]):
    """
    Updates the product record in Supabase with the full Living Page configuration.
    """
    try:
        supabase.table("products").update({"metadata": config}).eq("id", product_id).execute()
        return True
    except Exception as e:
        import logging
        logging.getLogger("agentz.pages").error(f"Failed to publish living page for {product_id}: {e}")
        return False
