"""
agentz.core.microsites
---------------------
Microsite Agent: Autonomously manages personalized sales assets on Cloudflare R2 and Vercel.
"""
from __future__ import annotations
import httpx
import logging
import os
from typing import Dict, Any
from agentz.core.credentials import get

logger = logging.getLogger("agentz.microsites")

def generate_microsite_html(lead_data: Dict[str, Any]) -> str:
    """Generates a high-fidelity 'Living Digital Twin' HTML page."""
    name = lead_data.get("name", "Valued Partner")
    amount = lead_data.get("amount", "TBD")
    
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{name} — Digital Twin</title>
<style>
  body {{ background: #000; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
  .card {{ border: 1px solid #00ff88; padding: 40px; border-radius: 20px; text-align: center; max-width: 500px; }}
  h1 {{ color: #00ff88; }}
</style>
</head>
<body>
  <div class="card">
    <h1>LIVING DIGITAL TWIN</h1>
    <h2>{name}</h2>
    <p>Pipeline Value: ${amount}</p>
    <p>Provisioned autonomously by AgentZ. Blockchain anchored.</p>
    <a href="https://authichain.com" style="color:#00ff88;">INITIALIZE PARTNERSHIP</a>
  </div>
</body>
</html>"""

async def deploy_sales_microsite(lead_data: Dict[str, Any]) -> str:
    """
    Deploys a personalized microsite by:
    1. Uploading HTML to R2.
    2. Linking Domain Alias in Vercel.
    """
    cf_token = get("cloudflare_api_token", required=False)
    cf_account = get("cloudflare_account", required=False)
    v_token = get("vercel_session", required=False)
    
    project_id = "prj_mIb6SSMtMy8KsXg9gNta0T3tDJg1" # AuthiChain Unified V2
    slug = lead_data.get("slug", "demo")
    safe_slug = "".join(c if c.isalnum() else "-" for c in slug.lower()).strip("-")
    alias_domain = f"{safe_slug}.authichain.com"

    # 1. Cloudflare R2 Upload
    if cf_token and cf_account:
        url = f"https://api.cloudflare.com/client/v4/accounts/{cf_account}/r2/buckets/authichain-microsites/objects/{safe_slug}/index.html"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                await client.put(url, headers={"Authorization": f"Bearer {cf_token}", "Content-Type": "text/html"}, content=generate_microsite_html(lead_data))
                logger.info(f"R2 Uploaded: {alias_domain}")
        except Exception as e:
            logger.error(f"R2 Failed: {e}")

    # 2. Vercel Alias
    if v_token:
        url = f"https://api.vercel.com/v9/projects/{project_id}/domains"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(url, headers={"Authorization": f"Bearer {v_token}"}, json={"name": alias_domain})
                logger.info(f"Vercel Linked: {alias_domain}")
        except Exception as e:
            logger.error(f"Vercel Failed: {e}")
            
    return f"https://{alias_domain}"

async def trigger_redeploy():
    """
    Triggers a fresh production deployment of the unified protocol.
    """
    token = get("vercel_session")
    project_id = "prj_mIb6SSMtMy8KsXg9gNta0T3tDJg1"
    
    if not token: return False
    
    headers = {"Authorization": f"Bearer {token}"}
    url = f"https://api.vercel.com/v13/deployments"
    
    payload = {
        "name": "authichain-unified-v2",
        "project": project_id,
        "gitSource": {
            "type": "github",
            "repoId": "859665671",
            "ref": "main"
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(url, headers=headers, json=payload)
            return r.status_code == 200
    except:
        return False
