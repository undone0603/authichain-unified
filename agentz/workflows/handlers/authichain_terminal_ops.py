"""
agentz.workflows.handlers.authichain_terminal_ops
------------------------------------------------
Executes the final "Kill Chain" evolutions: Closer, Burn, Index, & Queue.
"""
from __future__ import annotations

import asyncio
import os

from supabase import Client, create_client

from agentz.core.analytics import publish_index_to_web
from agentz.core.closer import run_closing_loop
from agentz.core.credentials import get_or_placeholder
from agentz.core.llm import lm_manager
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.redemption import burn_qron_for_discount


def run(ctx: ExecutionContext) -> str:
    active_provider = os.getenv("LLM_PROVIDER", "openai").lower()
    use_local_model = active_provider == "local"

    if use_local_model:
        try:
            lm_manager.load_model("local-model")
        except Exception as e:
            ctx.step(f"Warning: Local model could not be loaded: {e}")

    try:
        supabase_url = get_or_placeholder("supabase_url", ctx)
        supabase_key = get_or_placeholder("supabase_service_key", ctx)
        supabase: Client = create_client(supabase_url, supabase_key)

        ctx.step("--- EXECUTING TERMINAL ECOSYSTEM OPS ---")

        ctx.step("Testing QRON Burn Utility (Reward-to-Discount)...")
        if ctx.mode == Mode.DRY_RUN:
            burn_res = {"siphon_billed": 0.05}
            ctx.step("Simulate QRON Burn event (Dry-run)")
        else:
            burn_res = ctx.step(
                "Simulate QRON Burn event: 50 QRON -> $5.00 Discount",
                action=lambda: asyncio.run(
                    burn_qron_for_discount(supabase, "0x742d...", 50.0, "detroit-brews")
                ),
            ) or {"siphon_billed": 0}

        ctx.step(
            f"   -> Burn Complete. Merchant Siphon Billed: ${burn_res.get('siphon_billed', 0)}"
        )

        ctx.step("Running Autonomous Closer: Monitoring Demo Views...")
        if ctx.mode == Mode.DRY_RUN:
            closings = [{"deal_id": "mock_deal", "payment_url": "https://stripe.com/mock"}]
            ctx.step("Check HubSpot deals and send closing packages (Dry-run)")
        else:
            closings = ctx.step(
                "Check HubSpot deals and send closing packages",
                action=lambda: asyncio.run(run_closing_loop(supabase)),
            ) or []

        if closings:
            ctx.step(f"   -> Closings Initiated: {len(closings)} leads moved to Agreement stage.")
        else:
            ctx.step("   -> No new closings ready (awaiting demo views).")

        ctx.step("Generating Global Authenticity Index for AuthiChain.com...")
        if ctx.mode == Mode.DRY_RUN:
            index = [{"industry": "Luxury", "avg_score": 99}]
            ctx.step("Aggregate industry rankings (Dry-run)")
        else:
            index = ctx.step(
                "Aggregate industry rankings",
                action=lambda: asyncio.run(publish_index_to_web(supabase)),
            ) or []

        if index:
            ctx.step(f"   -> Industry Leader: {index[0]['industry']} ({index[0]['avg_score']}%)")
        else:
            ctx.step("   -> No industry index data returned.")

        return "Terminal ecosystem evolutions operationalized. Kill chain is active."
    finally:
        if use_local_model:
            try:
                lm_manager.unload_model("local-model")
            except Exception:
                pass
