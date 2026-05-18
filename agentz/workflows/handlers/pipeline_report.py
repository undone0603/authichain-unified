"""
agentz.workflows.handlers.pipeline_report
----------------------------------------
Generates a snapshot of the revenue and infrastructure pipeline:
1. GovChain: SAM.gov opportunities (scored vs new).
2. Outreach: Michigan campaign (drafted vs sent).
3. CRM: HubSpot status (reset contacts).
"""
import httpx
from datetime import datetime, timezone
from agentz.core.credentials import get
from agentz.core.modes import ExecutionContext

def run(ctx: ExecutionContext) -> str:
    supa_url = get("supabase_url")
    supa_key = get("supabase_service_key", required=False) or get("supabase_anon")
    headers = {
        "apikey": supa_key,
        "Authorization": f"Bearer {supa_key}"
    }

    report = ["🚀 PIPELINE HEALTH SNAPSHOT"]

    # 1. GovChain Status
    ctx.step("Fetching GovChain opportunities status...")
    try:
        # Get all pursue opps
        r = httpx.get(f"{supa_url}/rest/v1/gov_opportunities?recommended_action=eq.pursue&select=notice_id,title,agency,deadline,fit_score", headers=headers, timeout=15)
        pursue_opps = r.json()
        
        r_all = httpx.get(f"{supa_url}/rest/v1/gov_opportunities?select=status", headers=headers, timeout=10)
        all_opps = r_all.json()
        
        total = len(all_opps)
        scored = len([o for o in all_opps if o.get('status') == 'scored'])
        pursue_count = len(pursue_opps)
        
        report.append(f"🏛️  GOVCHAIN: {total} total opps, {scored} scored, {pursue_count} marked 'pursue'")
        
        if pursue_opps:
            import csv
            csv_path = "gov_pursue_list.csv"
            with open(csv_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=["notice_id", "title", "agency", "deadline", "fit_score"])
                writer.writeheader()
                writer.writerows(pursue_opps)
            report.append(f"   └─ Exported {pursue_count} leads to {csv_path}")

    except Exception as e:
        report.append(f"🏛️  GOVCHAIN: Failed to fetch ({str(e)})")

    # 2. Michigan Outreach Status
    ctx.step("Fetching Michigan outreach status...")
    try:
        r = httpx.get(f"{supa_url}/rest/v1/email_drafts?select=status", headers=headers, timeout=10)
        drafts = r.json()
        total_drafts = len(drafts)
        pending = len([d for d in drafts if d.get('status') == 'draft'])
        sent = len([d for d in drafts if d.get('status') == 'sent'])
        report.append(f"📧 OUTREACH: {total_drafts} total drafts, {sent} sent, {pending} pending review")
    except Exception as e:
        report.append(f"📧 OUTREACH: Failed to fetch ({str(e)})")

    # 3. CRM Health
    ctx.step("Fetching CRM stats...")
    hubspot_token = get("hubspot_token")
    h_headers = {"Authorization": f"Bearer {hubspot_token}"}
    try:
        search_body = {
            "filterGroups": [{
                "filters": [{"propertyName": "hs_lead_status", "operator": "EQ", "value": "OPEN"}]
            }],
            "limit": 1
        }
        r = httpx.post("https://api.hubapi.com/crm/v3/objects/contacts/search", headers=h_headers, json=search_body, timeout=10)
        open_contacts = r.json().get('total', 0)
        report.append(f"🧡 CRM: {open_contacts} contacts in 'OPEN' status (Sequences Active)")
    except Exception as e:
        report.append(f"🧡 CRM: Failed to fetch HubSpot stats")

    # 4. Stripe Revenue
    ctx.step("Fetching Stripe revenue...")
    stripe_key = get("stripe_secret")
    s_headers = {"Authorization": f"Bearer {stripe_key}"}
    try:
        # Get charges in last 30 days
        import time
        thirty_days_ago = int(time.time()) - (30 * 24 * 60 * 60)
        r = httpx.get(f"https://api.stripe.com/v1/charges?created[gte]={thirty_days_ago}", headers=s_headers, timeout=10)
        charges = r.json().get('data', [])
        total_rev = sum(c['amount'] for c in charges if c['paid'] and not c['refunded']) / 100
        report.append(f"💰 REVENUE (30d): ${total_rev:,.2f}")
    except Exception as e:
        report.append(f"💰 REVENUE (30d): Failed to fetch Stripe stats")

    report.append(f"\nGenerated at: {datetime.now(timezone.utc).isoformat()}")
    
    full_report = "\n".join(report)
    print(full_report)
    return full_report
