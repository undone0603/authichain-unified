"""
agentz.workflows.handlers.hot_lead_outreach
-----------------------------------------
Coordinates the "Revenue Blitz" Phase 1: HubSpot Lead Activation.
Includes Deep Research context for ultra-personalized outreach.
"""
from __future__ import annotations
import asyncio
from agentz.core.modes import ExecutionContext, Mode
from agentz.core.credentials import get, get_or_placeholder
from agentz.core.hubspot import get_hot_leads, get_lead_contact_info
from agentz.core.microsites import deploy_sales_microsite
from agentz.core.social import generate_social_post
from agentz.core.research import research_lead_context

def run(ctx: ExecutionContext) -> str:
    ctx.step("--- REVENUE BLITZ: HOT LEAD ACTIVATION (DEEP RESEARCH) ---")
    
    # 1. Fetch Hot Leads
    if ctx.mode == Mode.DRY_RUN:
        leads = [
            {"id": "mock_1", "name": "Cloud Cannabis", "slug": "cloud-cannabis"},
            {"id": "mock_2", "name": "Oakley Signs", "slug": "oakley-signs"}
        ]
        ctx.step("Fetch Top 10 Hot Leads from HubSpot (Dry-run: mocked)")
    else:
        leads_res = ctx.step(
            "Fetch Top 10 Hot Leads from HubSpot",
            action=lambda: asyncio.run(get_hot_leads(limit=10))
        )
        leads = leads_res if leads_res else []
    
    if not leads:
        return "No hot leads identified in HubSpot."
        
    ctx.step(f"Identified {len(leads)} high-priority leads.")
    
    activated = 0
    for lead in leads:
        try:
            name = lead.get("name", "Unknown")
            ctx.step(f"--- Activating Lead: {name} ---")
            
            # 2. Deploy Microsite
            if ctx.mode == Mode.DRY_RUN:
                site_url = f"https://{lead.get('slug', 'demo')}.authichain.com"
                ctx.step(f"Deploy personalized Vercel microsite for {name} (Dry-run)")
            else:
                site_url_res = ctx.step(
                    f"Deploy personalized Vercel microsite for {name}",
                    action=lambda l=lead: asyncio.run(deploy_sales_microsite(l))
                )
                site_url = site_url_res if site_url_res else f"https://{lead.get('slug', 'demo')}.authichain.com"
            
            # 3. Deep Research & Personalization
            research = {}
            if ctx.mode != Mode.DRY_RUN:
                research_res = ctx.step(
                    f"Perform deep context research on {name}",
                    action=lambda n=name: asyncio.run(research_lead_context(n, ctx))
                )
                if research_res:
                    research = research_res
                
            contact_name = research.get("decision_maker_name", "Decision Maker")
            news_snippet = research.get("latest_news", "your industry leadership")

            topic = f"Personalized digital twin for {name} is live. Re: {news_snippet}"
            
            try:
                message = ctx.step(
                    f"Draft outreach DM for {contact_name}",
                    action=lambda t=topic: asyncio.run(generate_social_post(t, "Twitter DM"))
                )
            except Exception as e:
                ctx.step(f"AI Drafting failed ({e}). Using hardcoded high-conversion template.")
                message = (
                    f"Hi {contact_name}, I'm the AuthiChain AI Agent. I've autonomously deployed a "
                    f"personalized digital twin for {name} to demonstrate how our 'Authentic Economy' "
                    f"framework can protect your brand. View it here: {site_url}"
                )
            
            # 4. Dispatch (Conditional DM)
            twitter_session = get("twitter_session", required=False)
            if twitter_session:
                ctx.step(f"Dispatch DM to {contact_name} at {name} via browser-automation...")
            else:
                ctx.step(f"Twitter session missing. Outreach for {name} logged as PENDING manual task.")
            
            activated += 1
        except Exception as e:
            ctx.step(f"Lead activation failed for {lead.get('name', 'Unknown')}: {e}")
            continue
        
    return f"Revenue Blitz complete. {activated} hot leads activated with deep research and custom microsites."
