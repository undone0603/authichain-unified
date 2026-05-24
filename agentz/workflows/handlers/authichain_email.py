"""
agentz.workflows.handlers.authichain_email
------------------------------------------
Hits HubSpot API to find active deals, generates a customized cold
email follow-up for Authichain, and queues it or sends via Gmail.
"""
import httpx
from agentz.core.modes import ExecutionContext
from agentz.core.credentials import get_or_placeholder, get
from agentz.core.llm import get_llm

def run(ctx: ExecutionContext) -> str:
    token = get_or_placeholder("hubspot_token", ctx)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    ctx.step("Querying HubSpot for active Authichain deals without recent contact...")
    
    # We simulate querying for deals where notes_last_contacted is old
    body = {
        "filterGroups": [{
            "filters": [
                {"propertyName": "dealstage", "operator": "NEQ", "value": "closedwon"},
                {"propertyName": "dealstage", "operator": "NEQ", "value": "closedlost"}
            ]
        }],
        "properties": ["dealname", "dealstage", "amount"],
        "limit": 3
    }
    
    if ctx.mode == "dry-run":
        ctx.step("dry-run: querying hubspot deals")
        return "dry-run: authichain_email"
        
    r = httpx.post("https://api.hubapi.com/crm/v3/objects/deals/search", headers=headers, json=body, timeout=15.0)
    if r.status_code != 200:
        return f"HubSpot error: {r.status_code}"
        
    results = r.json().get("results", [])
    if not results:
        return "No active deals found"
        
    sent = 0
    llm = get_llm(model="limit-proof", temperature=0.3)
    
    for d in results:
        deal_name = d['properties'].get('dealname', 'Unknown')
        deal_id = d['id']
        
        ctx.step(f"Finding contacts for deal: {deal_name}")
        r2 = httpx.get(f"https://api.hubapi.com/crm/v3/objects/deals/{deal_id}/associations/contacts", headers=headers, timeout=10.0)
        contacts = r2.json().get("results", []) if r2.status_code == 200 else []
        
        target_emails = []
        for c in contacts:
            r3 = httpx.get(f"https://api.hubapi.com/crm/v3/objects/contacts/{c['id']}?properties=email", headers=headers, timeout=10.0)
            if r3.status_code == 200:
                email = r3.json().get("properties", {}).get("email")
                if email:
                    target_emails.append(email)
                    
        if not target_emails:
            ctx.step(f"Skipping {deal_name} - no email contacts found.")
            continue
            
        ctx.step(f"Drafting email for {target_emails[0]} (Deal: {deal_name})...")
        
        prompt = f"""
        Write a short, professional, 3-sentence B2B follow-up email for the deal '{deal_name}'.
        We are Authichain, the autonomous compliance layer for Bitcoin.
        The goal is to schedule a 10-minute technical review next week.
        Do not include subject line, just body.
        """
        response = llm.invoke(prompt)
        email_body = response.content.strip()
        
        ctx.step(f"Generated email: {email_body[:50]}...")
        
        # Send actual email via Gmail SMTP
        def _send():
            import smtplib
            from email.message import EmailMessage
            
            gmail_user = get("gmail_user", required=True)
            gmail_pwd = get("gmail_app_password", required=True)
            
            msg = EmailMessage()
            msg.set_content(email_body)
            msg["Subject"] = f"Following up: {deal_name} & Authichain"
            msg["From"] = gmail_user
            msg["To"] = ", ".join(target_emails)
            
            try:
                server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
                server.login(gmail_user, gmail_pwd)
                server.send_message(msg)
                server.quit()
                return True
            except Exception as e:
                return f"SMTP failed: {e}"
        
        res = ctx.step(f"Send email to {', '.join(target_emails)}", action=_send)
        if res is True:
            sent += 1
        else:
            ctx.step(f"Failed to send email: {res}")
        
    return f"Sent {sent} Authichain follow-up emails"
