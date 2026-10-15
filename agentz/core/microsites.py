"""
agentz.core.microsites
---------------------
Microsite Agent: Autonomously manages personalized sales assets on Cloudflare R2 and Cloudflare Custom Hostnames.
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
<title>{name} - Digital Twin</title>
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
    <p>Provisioned autonomously by AgentZ. Cloudflare Edge anchored.</p>
    <a href="https://authichain.com" style="color:#00ff88;">INITIALIZE PARTNERSHIP</a>
  </div>
</body>
</html>"""

async def deploy_sales_microsite(lead_data: Dict[str, Any]) -> str:
    """
    Deploys a personalized microsite by:
    1. Uploading HTML to Cloudflare R2.
    2. Registering Custom Hostname Alias in Cloudflare Zone.
    """
    cf_token = get("cloudflare_api_token", required=False)
    cf_account = get("cloudflare_account", required=False)
    cf_zone_id = get("cloudflare_zone_id", required=False)
    
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

    # 2. Cloudflare Custom Hostname Alias
    if cf_token and cf_zone_id:
        url = f"https://api.cloudflare.com/client/v4/zones/{cf_zone_id}/custom_hostnames"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                payload = {
                    "hostname": alias_domain,
                    "ssl": {"method": "http", "type": "dv"}
                }
                await client.post(url, headers={"Authorization": f"Bearer {cf_token}"}, json=payload)
                logger.info(f"Cloudflare Custom Hostname Linked: {alias_domain}")
        except Exception as e:
            logger.error(f"Cloudflare Custom Hostname Failed: {e}")
            
    return f"https://{alias_domain}"

async def trigger_redeploy():
    """
    Triggers Cloudflare Worker / Pages edge update via cache purge or deployment hook.
    """
    cf_token = get("cloudflare_api_token", required=False)
    cf_zone_id = get("cloudflare_zone_id", required=False)
    
    if not cf_token or not cf_zone_id:
        return False
        
    headers = {"Authorization": f"Bearer {cf_token}", "Content-Type": "application/json"}
    url = f"https://api.cloudflare.com/client/v4/zones/{cf_zone_id}/purge_cache"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(url, headers=headers, json={"purge_everything": True})
            return r.status_code == 200
    except:
        return False
