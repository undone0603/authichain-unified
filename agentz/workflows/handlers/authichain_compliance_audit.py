"""
agentz.workflows.handlers.authichain_compliance_audit
-----------------------------------------------------
EU Digital Product Passport (DPP) compliance audit:
research mandates -> scan the ledger -> flag non-compliant items.

Delegates the audit logic to agentz.core.compliance; this handler is the
ctx-aware orchestration shell so it composes with the runner's modes.
"""
from __future__ import annotations

import asyncio

from supabase import Client, create_client

from agentz.core.compliance import (
    research_dpp_requirements,
    run_global_compliance_audit,
)
from agentz.core.credentials import get_or_placeholder
from agentz.core.llm import lm_manager
from agentz.core.modes import ExecutionContext, Mode


def run(ctx: ExecutionContext) -> str:
    lm_manager.load_model("local-model")
    try:
        supabase_url = get_or_placeholder("supabase_url", ctx)
        supabase_key = get_or_placeholder("supabase_service_key", ctx)
        supabase: Client = create_client(supabase_url, supabase_key)

        ctx.step("--- EU DPP COMPLIANCE AUDIT ---")

        # 1. Research current mandates (browser-use call; mocked in dry-run)
        ctx.step("Researching current EU DPP mandates for luxury vertical...")
        if ctx.mode == Mode.DRY_RUN:
            requirements = [
                "origin_country",
                "material_composition",
                "carbon_footprint_total",
                "circularity_index",
            ]
            ctx.step(f"   -> (dry-run mandate set: {len(requirements)} fields)")
        else:
            requirements = ctx.step(
                "Fetch DPP mandates from EU Commission portal",
                action=lambda: asyncio.run(research_dpp_requirements("luxury", ctx)),
            ) or []
            ctx.step(f"   -> {len(requirements)} mandatory field(s) identified")

        # 2. Audit the live ledger
        ctx.step("Auditing product ledger against mandate set...")
        if ctx.mode == Mode.DRY_RUN:
            results = [
                {"product_id": "<dry-run-sample>", "status": "NON_COMPLIANT", "missing": requirements[:2]},
            ]
            ctx.step("   -> (dry-run: would scan up to 10 products)")
        else:
            results = ctx.step(
                "Scan products and write dpp_compliance metadata",
                action=lambda: asyncio.run(run_global_compliance_audit(supabase, ctx)),
            ) or []

        # 3. Summarize
        compliant = sum(1 for r in results if r.get("status") == "COMPLIANT")
        flagged = [r for r in results if r.get("status") == "NON_COMPLIANT"]
        ctx.step(
            f"Audit complete: {compliant}/{len(results)} compliant, "
            f"{len(flagged)} flagged for remediation"
        )
        if flagged:
            sample = flagged[0]
            ctx.step(
                f"   -> e.g. product {sample.get('product_id')} missing {sample.get('missing')}"
            )

        return (
            f"DPP audit run against {len(requirements)} field(s); "
            f"{compliant}/{len(results)} compliant, {len(flagged)} flagged."
        )
    finally:
        lm_manager.unload_model("local-model")
