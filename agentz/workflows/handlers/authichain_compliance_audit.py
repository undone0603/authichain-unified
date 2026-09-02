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
import os

from supabase import Client, create_client

from agentz.core.compliance import (
    research_compliance_requirements,
    scan_product_compliance,
)
from agentz.core.credentials import check_all, get_or_placeholder
from agentz.core.llm import lm_manager
from agentz.core.modes import ExecutionContext, Mode

# Credentials required to talk to the live product ledger. Both must resolve
# to env vars (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) for a live run.
REQUIRED_CREDENTIALS = ["supabase_url", "supabase_service_key"]


def run(ctx: ExecutionContext) -> str:
    # 0. Skip gracefully instead of crashing when Supabase creds aren't
    # configured (e.g. PRs/forks without repo secrets). Dry-run mode already
    # tolerates missing credentials via get_or_placeholder below.
    if ctx.mode != Mode.DRY_RUN:
        _, missing = check_all(REQUIRED_CREDENTIALS)
        if missing:
            msg = f"Skipping compliance audit: missing credentials {missing}"
            ctx.step(msg)
            return msg

    # 1. Smarter Initialization: Check the environment first
    active_provider = os.getenv("LLM_PROVIDER", "openai").lower()
    use_local_model = active_provider == "local"

    # Only load the local model if we explicitly requested it, preventing Errno 111 in the cloud
    if use_local_model:
        try:
            lm_manager.load_model("local-model")
        except Exception as e:
            ctx.step(f"Warning: Local model could not be loaded: {e}")

    try:
        supabase: Client | None = None
        if ctx.mode != Mode.DRY_RUN:
            supabase_url = get_or_placeholder("supabase_url", ctx)
            supabase_key = get_or_placeholder("supabase_service_key", ctx)
            supabase = create_client(supabase_url, supabase_key)
        else:
            ctx.step("Supabase client skipped (dry-run)")

        ctx.step("--- EU DPP COMPLIANCE AUDIT ---")

        # 1. Research current mandates (table lookup; dry-run uses baseline fields)
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
                "Fetch DPP mandates from regulatory profile table",
                action=lambda: asyncio.run(research_compliance_requirements("luxury", ctx)),
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
            assert supabase is not None
            products = supabase.table("products").select("id").limit(10).execute().data or []

            async def _audit_batch():
                out = []
                for p in products:
                    out.append(await scan_product_compliance(supabase, p["id"], requirements))
                return out

            results = ctx.step(
                "Scan products and write dpp_compliance metadata",
                action=lambda: asyncio.run(_audit_batch()),
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
        # Only attempt to unload if we tried to load it
        if use_local_model:
            try:
                lm_manager.unload_model("local-model")
            except Exception:
                pass
