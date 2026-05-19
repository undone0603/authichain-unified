"""
agentz.workflows.handlers.polygon_grants
---------------------------------------
Drafts a Polygon Ecosystem Grant application based on the recent
technical work (Watchdog simulator, autonomous anchoring).
"""
import httpx
import json
from datetime import datetime, timezone
from agentz.core.credentials import get
from agentz.core.modes import ExecutionContext

def run(ctx: ExecutionContext) -> str:
    ctx.step("Fetching technical context for grant...")
    
    tech_context = """
    Project: AuthiChain / QRON
    Recent Work: Developed an Edge Watchdog simulator that monitors environmental 
    conditions (AgTech focus) and autonomously anchors compliance breaches to 
    the Polygon blockchain using custom API triggers. 
    Value: Removes human intervention from regulatory audit trails.
    Stack: Next.js, Supabase, Cloudflare Workers, Polygon (ethers.js).
    """

    prompt = f"""
    You are a technical grant writer for AuthiChain. 
    Draft a Polygon Ecosystem Grant application focusing on our 'Autonomous Compliance' layer.
    
    Context:
    {tech_context}
    
    Sections to include:
    1. Project Name & Description
    2. Problem Statement (Regulatory friction, human error in auditing)
    3. Solution (Autonomous Edge Anchoring on Polygon)
    4. Technical Implementation Details
    5. Roadmap for Q3 2026 (Mainnet launch, Mobile SDK)
    
    Respond with the full application draft in Markdown.
    """

    ctx.step("Generating grant application draft via cascading LLM...")
    
    providers = [
        {"name": "OpenAI", "url": "https://api.openai.com/v1/chat/completions", "key": get("openai_api_key", required=False), "model": "gpt-4o"},
        {"name": "Groq", "url": "https://api.groq.com/openai/v1/chat/completions", "key": get("groq_api_key", required=False), "model": "llama-3.1-8b-instant"},
        {"name": "Gemini", "url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", "key": get("gemini_api_key", required=False), "model": "gemini-2.5-flash"}
    ]

    last_error = None
    for p in providers:
        if not p["key"]: continue
        
        ctx.step(f"Attempting invoke via {p['name']}...")
        try:
            headers = {
                "Authorization": f"Bearer {p['key']}",
                "Content-Type": "application/json"
            }
            body = {
                "model": p["model"],
                "messages": [{"role": "user", "content": prompt}]
            }
            r = httpx.post(p["url"], headers=headers, json=body, timeout=30.0)
            if r.status_code == 200:
                draft = r.json()['choices'][0]['message']['content']
                with open("polygon_grant_draft.md", "w", encoding="utf-8") as f:
                    f.write(draft)
                return "Grant application drafted and saved to polygon_grant_draft.md"
            else:
                last_error = f"{p['name']} {r.status_code}: {r.text[:100]}"
        except Exception as e:
            last_error = f"{p['name']} exception: {str(e)}"
            
    return f"Failed to draft grant. Last error: {last_error}"
