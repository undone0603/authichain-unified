"""
agentz.core.compliance
----------------------
Compliance Agent: Monitors EU Digital Product Passport (DPP) regulations
and flags products for metadata gaps.
"""
from __future__ import annotations

import logging
from typing import Dict, Any, List, Optional

from agentz.core.modes import ExecutionContext

logger = logging.getLogger("agentz.compliance")

# Mandatory DPP fields by vertical, per the EU Ecodesign for Sustainable
# Products Regulation (ESPR) and its sector-specific delegated acts. These
# change on a regulatory timescale (months/years), not per CI run, so they're
# maintained here as a static table rather than re-derived via a live LLM/
# browser-automation lookup on every workflow execution — that path required
# a paid LLM key and was failing regardless of key validity (browser-use
# navigation errors). Update this table when the EU Commission publishes new
# delegated acts for a vertical (see CLAUDE.md for the enforcement calendar:
# battery Feb 18 2027, cannabis/textile Q2 2027).
_BASELINE_FIELDS = ["origin_country", "material_composition", "carbon_footprint_total", "circularity_index"]

# Regulatory Compliance Profiles
REGULATORY_PROFILES: Dict[str, List[str]] = {
    "pharmaceutical_dscsa": [
        "gtin14", "serial", "lot", "expiry", "trading_partner_id", "transaction_id"
    ],
    "medical_device_udi": [
        "udi_di", "udi_pi_lot", "udi_pi_serial", "udi_pi_expiry", "device_model", "manufacturer_gln"
    ]
}

async def research_compliance_requirements(profile: str, ctx: Optional[ExecutionContext] = None) -> List[str]:
    """
    Research requirements based on the formalized regulatory profile.
    """
    if ctx:
        ctx.step(f"Looked up regulatory mandate table for profile='{profile}'")
    return REGULATORY_PROFILES.get(profile.lower(), _BASELINE_FIELDS)



async def scan_product_compliance(supabase, product_id: str, requirements: List[str]) -> Dict[str, Any]:
    product_res = supabase.table("products").select("metadata").eq("id", product_id).single().execute()
    metadata = product_res.data.get("metadata", {})

    missing_fields = [req for req in requirements if req not in metadata]
    status = "COMPLIANT" if not missing_fields else "NON_COMPLIANT"

    supabase.table("products").update({
        "metadata": {
            **metadata,
            "dpp_compliance": {
                "status": status,
                "missing_fields": missing_fields,
                "last_checked": "now()"
            }
        }
    }).eq("id", product_id).execute()

    return {
        "product_id": product_id,
        "status": status,
        "missing": missing_fields
    }


async def generate_audit_report(supabase, vertical: str) -> Dict[str, Any]:
    """
    Generates an audit-ready compliance report for regional mandates.
    """
    reqs = await research_compliance_requirements(vertical)
    
    # Fetch all products in the vertical
    products = supabase.table("products").select("id, name, metadata").eq("industry_id", vertical).execute().data
    
    report = {
        "vertical": vertical,
        "total_products": len(products),
        "compliant_count": 0,
        "details": []
    }
    
    for p in products:
        compliance = p.get("metadata", {}).get("dpp_compliance", {})
        is_compliant = compliance.get("status") == "COMPLIANT"
        
        if is_compliant:
            report["compliant_count"] += 1
            
        report["details"].append({
            "product_id": p["id"],
            "name": p["name"],
            "status": compliance.get("status", "UNKNOWN")
        })
        
    return report


class GDPRHandler:
    """
    Handles Right to be Forgotten (RTBF) requests by scrubbing PII
    from telemetry and interaction logs while preserving aggregate metrics.
    """
    def __init__(self, supabase):
        self.supabase = supabase

    async def scrub_user_data(self, user_id: str, ctx: Optional[ExecutionContext] = None) -> bool:
        if ctx:
            ctx.step(f"Executing GDPR RTBF scrub for user {user_id}...")
        
        try:
            # 1. Scrub telemetry events
            self.supabase.table("telemetry_events").update({
                "userId": "SCRUBBED",
                "rawPayload": {"status": "PII_REMOVED"}
            }).eq("userId", user_id).execute()

            # 2. Scrub scan logs
            self.supabase.table("scan_logs").delete().eq("userId", user_id).execute()

            if ctx:
                ctx.step(f"✓ Successfully scrubbed all PII for user {user_id}.")
            return True
        except Exception as e:
            if ctx:
                ctx.step(f"Error during GDPR scrub: {e}")
            return False
