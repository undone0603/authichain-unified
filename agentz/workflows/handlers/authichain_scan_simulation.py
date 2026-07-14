"""
agentz.workflows.handlers.authichain_scan_simulation
--------------------------------------------------
Executes the full "Atomic Action" loop: Scan -> Verify -> StoryMode -> Reward -> Analytics.
"""
from __future__ import annotations
import asyncio
import random
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.credentials import get_or_placeholder
from agentz.core.trust import monitor_scans
from agentz.core.media import generate_story_mode
from agentz.core.growth import reward_repeat_scans
from agentz.core.blockchain import BlockchainAgent
from agentz.core.llm import lm_manager
from supabase import create_client, Client

def run(ctx: ExecutionContext) -> str:
    lm_manager.load_model("local-model")
    try:
        # 1. Setup
        supabase_url = get_or_placeholder("supabase_url", ctx)
        supabase_key = get_or_placeholder("supabase_service_key", ctx)
        supabase: Client = create_client(supabase_url, supabase_key)
        
        ctx.step("🚀 --- INITIALIZING ATOMIC SCAN ACTION --- 🚀")
        
        # 2. Select Target Product
        product_id = "43ed4724-724c-49ed-a5fe-d712f6121578" # Detroit Pilot (Valid qron_id)
        wallet_address = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e" # Sample User
        
        ctx.step(f"Step 1: Simulating QR Scan for Product {product_id}...")
        
        # 3. Verify Authenticity & Load Timeline
        ctx.step("Step 2: Verifying Authenticity & Appending Timeline event...")
        score = ctx.step(
            "Run Trust Agent: Authenticity Check",
            action=lambda: asyncio.run(monitor_scans(supabase, product_id))
        )
        ctx.step(f"   -> Authenticity Score: {score}%")
        
        # 4. Generate StoryMode & AI Narration
        ctx.step("Step 3: Generating StoryMode AI Narration...")
        narration_url = ctx.step(
            "Run Media Agent: StoryMode Generation",
            action=lambda: asyncio.run(generate_story_mode(supabase, product_id))
        )
        ctx.step(f"   -> StoryMode Video Live at: {narration_url}")
        
        # 5. Issue QRON Rewards
        ctx.step("Step 4: Issuing QRON Engagement Rewards...")
        reward_res = ctx.step(
            "Run Growth Agent: Reward Issuance",
            action=lambda: asyncio.run(reward_repeat_scans(supabase, wallet_address, product_id))
        )
        ctx.step(f"   -> Reward Issued: {reward_res.get('reward_amount')} QRON")
        ctx.step(f"   -> On-chain Tx: {reward_res.get('tx_hash')}")
        
        # 6. Update Merchant Analytics
        ctx.step("Step 5: Updating Merchant Analytics & Engagement Score...")
        # This happens automatically via monitor_scans and reward_repeat_scans updates in Supabase
        ctx.step("   -> Analytics Synced to Command Center.")
        
        ctx.step("🚀 --- ATOMIC ACTION COMPLETE --- 🚀")
        
        return f"Scan loop successfully completed for product {product_id}. Reward: {reward_res.get('reward_amount')} QRON."
    finally:
        lm_manager.unload_model("local-model")
