"""
compliance_scanner.py
---------------------
Autonomous workflow handler: Periodically audits products for EU DPP compliance
and triggers remediation for gaps.
"""
from __future__ import annotations

import asyncio

from agentz.core.compliance import research_compliance_requirements, scan_product_compliance
from agentz.core.credentials import get_supabase_client
from agentz.core.modes import ExecutionContext, Mode


def run(ctx: ExecutionContext):
    ctx.step("Initiating global compliance audit...")

    if ctx.mode == Mode.DRY_RUN:
        ctx.step("Would scan products against regulatory profile table (dry-run)")
        return "DRY_RUN: compliance audit would scan up to 10 products."

    supabase = get_supabase_client()
    requirements = asyncio.run(research_compliance_requirements("luxury", ctx))
    products = supabase.table("products").select("id").limit(10).execute().data or []

    results = []
    for p in products:
        results.append(asyncio.run(scan_product_compliance(supabase, p["id"], requirements)))

    non_compliant = [r for r in results if r["status"] == "NON_COMPLIANT"]

    if non_compliant:
        msg = f"Compliance audit complete. {len(non_compliant)} products require remediation."
        ctx.step(msg)
        return msg

    return "All products compliant."
