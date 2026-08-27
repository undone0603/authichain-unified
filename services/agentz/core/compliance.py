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

EU_DPP_REQUIREMENTS: Dict[str, List[str]] = {
    "luxury":    [*_BASELINE_FIELDS, "reparability_score", "substances_of_concern"],
    "textile":   [*_BASELINE_FIELDS, "fiber_composition", "microplastic_release", "recyclability_score"],
    "battery":   [*_BASELINE_FIELDS, "battery_chemistry", "recycled_content_cobalt", "recycled_content_lithium", "capacity_fade_rating"],
    "cannabis":  [*_BASELINE_FIELDS, "cultivation_method", "lab_test_reference"],
    "electronics": [*_BASELINE_FIELDS, "repairability_index", "software_support_duration"],
}


async def research_dpp_requirements(vertical: str, ctx: Optional[ExecutionContext] = None) -> List[str]:
    if ctx:
        ctx.step(f"Looked up static EU DPP mandate table for vertical='{vertical}'")
    return EU_DPP_REQUIREMENTS.get(vertical.lower(), _BASELINE_FIELDS)


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


async def run_global_compliance_audit(supabase, ctx: Optional[ExecutionContext] = None):
    reqs = await research_dpp_requirements("luxury", ctx)
    products = supabase.table("products").select("id").limit(10).execute().data

    results = []
    for p in products:
        res = await scan_product_compliance(supabase, p["id"], reqs)
        results.append(res)

    return results
