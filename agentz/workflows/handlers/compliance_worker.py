"""
agentz.workflows.handlers.compliance_worker
------------------------------------------
Autonomous Compliance Worker: Performs daily ledger audits against EU DPP mandates.
Flags non-compliant products and updates metadata for the Admin Dashboard.
"""
import asyncio
import logging
import os
import sys
from pathlib import Path

# Fix module imports
project_root = str(Path(__file__).parent.parent.parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from agentz.core.supabase import get_supabase
from agentz.core.compliance import research_dpp_requirements, scan_product_compliance
from agentz.core.modes import ExecutionContext, Mode

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("compliance-worker")

async def run_audit():
    ctx = ExecutionContext(workflow_id="daily_compliance_audit_v1", mode=Mode.AUTO)
    logger.info("🛡️ INITIALIZING GLOBAL COMPLIANCE AUDIT")
    
    sb = get_supabase()
    if not sb:
        logger.error("❌ Supabase connection failed.")
        return

    # 1. Research latest mandates (Luxury focus for Phase 1)
    logger.info("🔍 Step 1: Researching latest EU DPP mandates for Luxury...")
    requirements = await research_dpp_requirements("luxury", ctx)
    logger.info(f"✅ Active Mandates: {requirements}")

    # 2. Identify Products needing audit
    # In production: fetch products not checked in last 24h
    logger.info("📊 Step 2: Fetching ledger products for verification...")
    res = sb.table("products").select("id").limit(20).execute()
    products = res.data or []
    
    if not products:
        logger.info("✅ Ledger is clean. No products found.")
        return

    logger.info(f"🔍 Auditing {len(products)} products...")

    # 3. Perform Audit
    compliant_count = 0
    for p in products:
        try:
            result = await scan_product_compliance(sb, p["id"], requirements)
            if result["status"] == "COMPLIANT":
                compliant_count += 1
                logger.info(f"  ✅ Product {p['id']}: COMPLIANT")
            else:
                logger.warning(f"  ⚠️ Product {p['id']}: NON_COMPLIANT (Missing: {result['missing']})")
        except Exception as e:
            logger.error(f"  ❌ Audit failed for {p['id']}: {e}")

    # 4. Log completion
    logger.info(f"\n🏁 AUDIT COMPLETE: {compliant_count}/{len(products)} products compliant.")

if __name__ == "__main__":
    asyncio.run(run_audit())
