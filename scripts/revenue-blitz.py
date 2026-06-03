"""
scripts/revenue-blitz.py
-----------------------
AuthiChain Autonomous Revenue Blitz (Unified Pipeline)
1. Scout: Discovery of high-value pilot businesses.
2. HubSpot: Automatic CRM registration (Contact + Deal).
3. AI Assets: StoryMode + Concierge generation.
4. Microsite: Autonomous Vercel/R2 deployment of Living Digital Twin.
"""
import asyncio
import logging
import sys
import os
from pathlib import Path

# Fix module imports
project_root = str(Path(__file__).parent.parent)
if project_root not in sys.path:
    sys.path.append(project_root)

from agentz.core.modes import ExecutionContext, Mode
from agentz.core.scout import scout_businesses, deep_research_business
from agentz.core.hubspot import create_contact, create_deal
from agentz.core.supabase import upsert_lead
from agentz.core.media import generate_narration
from agentz.core.concierge import generate_concierge_persona
from agentz.core.marketing import detect_viral_trends, generate_viral_content
from agentz.core.microsites import deploy_sales_microsite

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("revenue-blitz")

async def run_blitz(city: str, dry_run: bool = True):
    mode = Mode.DRY_RUN if dry_run else Mode.AUTO
    ctx = ExecutionContext(workflow_id="revenue_blitz_v1", mode=mode)
    
    logger.info(f"🚀 INITIALIZING REVENUE BLITZ: {city} (Mode: {mode.value})")
    
    # 1. Scout Businesses
    logger.info(f"🔍 Step 1: Scouting high-value businesses...")
    businesses = await scout_businesses(city, ctx)
    
    if not businesses:
        logger.error("❌ No businesses found.")
        return

    for business in businesses[:2]:
        name = business.get("name", "Unknown")
        category = business.get("category", "General")
        
        logger.info(f"\n--- 🎯 TARGET: {name} ---")
        
        # 1.5 Deep Research
        business = await deep_research_business(business, ctx)
        deep_context = business.get("deep_context", "Standard profile")
        
        # 2. Register in HubSpot & Supabase
        logger.info(f"📊 Step 2: Registering Lead in CRM & Database...")
        email = f"innovation@{name.lower().replace(' ', '')}.com"
        slug = "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")
        while "--" in slug: slug = slug.replace("--", "-")

        lead_payload = {
            "email": email,
            "name": name,
            "company": name,
            "industry": category,
            "slug": slug,
            "metadata": {"deep_context": deep_context}
        }
        
        if dry_run:
            logger.info(f"  [DRY-RUN] Would upsert lead for {email} (slug: {slug})")
            logger.info(f"  [DRY-RUN] Would create HubSpot contact & deal")
        else:
            # Sync to Supabase for the Microsite
            lead = await upsert_lead(lead_payload)
            # Sync to HubSpot for Sales
            contact_id = await create_contact(email, "Innovation", "Lead")
            if contact_id:
                await create_deal(name=f"{name} Pilot", amount="199.00", stage="appointmentscheduled", contact_id=contact_id)
                logger.info(f"  ✅ Lead & Deal Registered.")

        # 3. Generate AI Content
        logger.info(f"🎬 Step 3: Generating StoryMode & Concierge Persona...")
        product_mock = {"name": name, "brand": name, "metadata": {"vertical": category, "deep_context": deep_context}}
        
        if dry_run:
            logger.info("  [DRY-RUN] Would generate AI narration & system persona")
        else:
            persona = await generate_concierge_persona(product_mock)
            logger.info(f"  ✅ Concierge Persona Built ({len(persona)} chars)")

        # 4. Microsite Provisioning
        logger.info(f"🌐 Step 4: Provisioning Dynamic Digital Twin Microsite...")
        microsite_url = f"https://authichain.com/microsite/{slug}"
        
        if dry_run:
            logger.info(f"  [DRY-RUN] Microsite ready at: {microsite_url}")
        else:
            # We no longer need to 'deploy' a static site, it's dynamic!
            logger.info(f"  ✅ MICROSITE LIVE: {microsite_url}")

        # 5. Viral Buzz Generation
        logger.info(f"🔥 Step 5: Generating Viral Social Kit...")
        trends = await detect_viral_trends(category, ctx)
        top_trend = trends[0] if trends else "Web3 Transparency"
        
        if dry_run:
            logger.info(f"  [DRY-RUN] Would generate TikTok/X kit for trend: {top_trend}")
        else:
            await generate_viral_content(business, top_trend)
            logger.info(f"  ✅ Social Kit Ready.")

    logger.info("\n🏁 REVENUE BLITZ COMPLETE. Check HubSpot for results.")

if __name__ == "__main__":
    import sys
    target = "Grand Rapids"
    is_real = False
    
    for arg in sys.argv[1:]:
        if arg == "--real":
            is_real = True
        else:
            target = arg
            
    asyncio.run(run_blitz(target, dry_run=not is_real))
