"""
agentz.workflows.handlers.strainchain_revenue
---------------------------------------------
Automated email outreach to cannabis testing labs and dispensaries
for the StrainChain $299 Certification Package.
"""
from agentz.core.modes import ExecutionContext
from agentz.core.credentials import get
from agentz.core.llm import get_llm

def run(ctx: ExecutionContext) -> str:
    ctx.step("Fetching list of target cannabis testing labs in Michigan...")
    
    # Real-world target list of licensed Safety Compliance Facilities in Michigan
    target_labs = [
        {"name": "ACT Lab", "contact": "info@actlab.com"},
        {"name": "Reassure Labs", "contact": "info@reassurelabs.com"},
        {"name": "SV Laboratories", "contact": "info@svlaboratories.com"},
        {"name": "Viridis Laboratories", "contact": "info@viridis-labs.com"},
        {"name": "SC Labs", "contact": "info@sclabs.com"},
        {"name": "North Coast Testing Laboratories", "contact": "info@northcoasttesting.com"}
    ]
    
    ctx.step(f"Found {len(target_labs)} high-intent leads.")
    
    if ctx.mode == "dry-run":
        return f"dry-run: would email {len(target_labs)} labs"
    
    try:
        llm = get_llm(model="limit-proof", temperature=0.3)
    except Exception as e:
        return f"Failed to initialize LLM: {e}"
        
    sent_count = 0
    for lab in target_labs:
        ctx.step(f"Drafting personalized pitch for {lab['name']}...")
        
        prompt = f"""
        Write a concise, 3-sentence B2B cold email to {lab['name']}.
        We are StrainChain, providing immutable cannabis product certifications inscribed directly onto Bitcoin.
        We are offering a $299 Pilot Package for testing labs to certify their first 50 batches.
        Call to action: Ask if they are available for a 5-minute demo this week.
        Do not include subject line, just body.
        """
        response = llm.invoke(prompt)
        email_body = response.content.strip()
        
        ctx.step(f"Generated email: {email_body[:50]}...")
        
        # Send actual email via Gmail SMTP
        def _send_pitch():
            import smtplib
            from email.message import EmailMessage
            
            gmail_user = get("gmail_user", required=True)
            gmail_pwd = get("gmail_app_password", required=True)
            
            msg = EmailMessage()
            msg.set_content(email_body)
            msg["Subject"] = "Blockchain Certification Pilot for Testing Labs"
            msg["From"] = gmail_user
            msg["To"] = lab['contact']
            
            try:
                server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
                server.login(gmail_user, gmail_pwd)
                server.send_message(msg)
                server.quit()
                return True
            except Exception as e:
                return f"SMTP failed: {e}"

        res = ctx.step(f"Send email to {lab['contact']}", action=_send_pitch)
        if res is True:
            sent_count += 1
        else:
            ctx.step(f"Failed to send email: {res}")
            
    return f"Successfully processed and queued {sent_count} StrainChain revenue pitches."
