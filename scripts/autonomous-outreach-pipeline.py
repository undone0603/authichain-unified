"""
scripts/autonomous-outreach-pipeline.py
---------------------------------------
Demonstrates the full Autonomous Outreach Pipeline:
1. Scout: Discovery of high-value pilot businesses.
2. HubSpot: Automatic CRM registration (Contact + Deal).
3. Personalization: Calculating pilot fit and mapping to industry verticals.
"""
import asyncio
import logging
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.scout import scout_businesses, calculate_pilot_fit, deep_research_business
from agentz.core.hubspot import create_contact, create_deal
from agentz.core.media import generate_narration
from agentz.core.concierge import generate_concierge_persona
from agentz.core.marketing import detect_viral_trends, generate_viral_content

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("autonomous-pipeline")

async def run_pipeline(city: str, dry_run: bool = True):
    mode = Mode.DRY_RUN if dry_run else Mode.AUTO
    ctx = ExecutionContext(workflow_id="autonomous_outreach_demo", mode=mode)
    
    logger.info(f"🚀 Starting Autonomous Outreach Pipeline for {city} (Mode: {mode.value})")
    
    # 1. Scout Businesses
    logger.info(f"🔍 Step 1: Scouting high-value businesses in {city}...")
    businesses = await scout_businesses(city, ctx)
    
    if not businesses:
        logger.error("❌ No businesses found.")
        return

    logger.info(f"✅ Found {len(businesses)} candidates. Processing top 3...")
    
    for business in businesses[:3]:
        name = business.get("name", "Unknown")
        score = business.get("score", 0)
        category = business.get("category", "General")
        website = business.get("website", "N/A")
        
        logger.info(f"--- Processing {name} (Score: {score}, Category: {category}) ---")
        
        # 1.5 Deep Research
        logger.info(f"🧠 Step 1.5: Deep research on {name} website ({website})...")
        business = await deep_research_business(business, ctx)
        deep_context = business.get("deep_context", "Standard profile")
        logger.info(f"  ✅ Extracted Context: {deep_context[:80]}...")
        
        # 2. Map to Contact Info (Mocking contact for demo)
        email = f"info@{name.lower().replace(' ', '')}.com"
        first_name = "Innovation"
        last_name = "Lead"
        
        # 3. Register in HubSpot
        logger.info(f"📊 Step 2: Registering {name} in HubSpot CRM...")
        
        if dry_run:
            contact_id = "mock-contact-id"
            deal_id = "mock-deal-id"
            logger.info(f"  [DRY-RUN] Would create contact for {email}")
            logger.info(f"  [DRY-RUN] Would create deal '{name} AuthiChain Pilot' for $199.00")
        else:
            contact_id = await create_contact(email, first_name, last_name)
            if contact_id:
                logger.info(f"  ✅ Contact created: {contact_id}")
                deal_id = await create_deal(
                    name=f"{name} AuthiChain Pilot",
                    amount="199.00",
                    stage="appointmentscheduled",
                    contact_id=contact_id
                )
                if deal_id:
                    logger.info(f"  ✅ Deal created: {deal_id}")
                else:
                    logger.error(f"  ❌ Failed to create deal for {name}")
            else:
                logger.error(f"  ❌ Failed to create contact for {name}")
        
        # 4. Generate AI Content (Kill-Chain Expansion)
        logger.info(f"🎬 Step 3: Generating StoryMode content & Concierge Persona...")
        
        product_mock = {
            "name": name,
            "brand": name,
            "metadata": {
                "vertical": category,
                "deep_context": deep_context
            },
            "authenticity_score": score
        }
        
        if dry_run:
            logger.info("  [DRY-RUN] Would generate AI narration script")
            logger.info("  [DRY-RUN] Would generate AI Concierge system persona")
        else:
            narration = await generate_narration(product_mock)
            logger.info(f"  ✅ Narration Drafted: {narration[:60]}...")
            
            persona = await generate_concierge_persona(product_mock)
            logger.info(f"  ✅ Concierge Persona Created (System Prompt length: {len(persona)} chars)")
            
            # Simulate updating metadata for the demo
            product_mock["metadata"]["persona_prompt"] = persona
            product_mock["metadata"]["narration_script"] = narration

        # 5. Viral Buzz Generation
        logger.info(f"🔥 Step 4: Generating Viral Buzz (TikTok/X Content)...")
        trends = await detect_viral_trends(category, ctx)
        top_trend = trends[0]
        
        if dry_run:
            logger.info(f"  [DRY-RUN] Detected trend: {top_trend}")
            logger.info(f"  [DRY-RUN] Would generate viral social kit for {name}")
            viral_kit = {"hook": "...", "x_post": "..."}
        else:
            viral_kit = await generate_viral_content(business, top_trend)
            logger.info(f"  ✅ TikTok Hook: {viral_kit.get('hook')}")
            logger.info(f"  ✅ X Post: {viral_kit.get('x_post')[:50]}...")
            
        # 6. Final Summary
        logger.info(f"✨ {name} is now fully provisioned for autonomous outreach.")
        logger.info(f"   -> Interactive Concierge: ACTIVE (Persona: {name} Advocate)")
        logger.info(f"   -> StoryMode: QUEUED (Script: '{narration[:40] if not dry_run else '...' }')")
        logger.info(f"   -> Viral Buzz: READY (Trend: {top_trend})")
        logger.info(f"   -> Rewards: ENABLED (10 QRON/scan)")

    logger.info("🏁 Pipeline demonstration complete.")

if __name__ == "__main__":
    import sys
    target_city = sys.argv[1] if len(sys.argv) > 1 else "Detroit"
    asyncio.run(run_pipeline(target_city, dry_run=True))
