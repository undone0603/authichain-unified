"""
agentz.core.microsites
---------------------
Microsite Agent: Autonomously manages high-fidelity, brand-aligned sales assets.
"""
from __future__ import annotations
import httpx
import logging
import os
from typing import Dict, Any
from agentz.core.credentials import get

logger = logging.getLogger("agentz.microsites")

# Mapping industries to brand-aligned domains
BRAND_DOMAIN_MAP = {
    "luxury": "authichain.com",
    "tech": "qron.space",
    "gov": "govchain.us",
    "cannabis": "strainchain.io"
}

# CSS Token mapping
BRAND_THEMES = {
    "authichain.com": {"primary": "#c9a227", "bg": "#0a0a0a", "text": "#ffffff"},
    "qron.space": {"primary": "#00ff88", "bg": "#050505", "text": "#ffffff"},
    "govchain.us": {"primary": "#004a99", "bg": "#ffffff", "text": "#111111"},
    "strainchain.io": {"primary": "#2d5a27", "bg": "#f4fcf2", "text": "#1a1a1a"}
}

def generate_microsite_html(lead_data: Dict[str, Any], domain: str) -> str:
    """Generates a high-fidelity, brand-aligned microsite."""
    name = lead_data.get("name", "Valued Partner")
    amount = lead_data.get("amount", "TBD")
    theme = BRAND_THEMES.get(domain, BRAND_THEMES["authichain.com"])
    
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Partnership - {name}</title>
<style>
  body {{ background: {theme['bg']}; color: {theme['text']}; font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
  .card {{ border: 2px solid {theme['primary']}; padding: 60px; border-radius: 30px; text-align: center; max-width: 600px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
  h1 {{ color: {theme['primary']}; text-transform: uppercase; letter-spacing: 0.1em; }}
  a {{ display: inline-block; margin-top: 30px; padding: 15px 30px; background: {theme['primary']}; color: #fff; text-decoration: none; border-radius: 10px; font-weight: bold; }}
</style>
</head>
<body>
  <div class="card">
    <h1>Strategic Alliance</h1>
    <h2>{name}</h2>
    <p>Pipeline Opportunity: ${amount}</p>
    <p>Authenticated by {domain.split('.')[0].upper()} Ledger.</p>
    <a href="https://{domain}">INITIALIZE PROTOCOL</a>
  </div>
</body>
</html>"""

async def deploy_sales_microsite(lead_data: Dict[str, Any]) -> str:
    """
    Deploys a brand-aligned microsite.
    """
    cf_token = get("cloudflare_api_token", required=False)
    cf_account = get("cloudflare_account", required=False)
    v_token = get("vercel_session", required=False)

    project_id = "prj_avIBQb2HRqlvpHE6VN2N2wBlRdgq"
    slug = lead_data.get("slug", "demo")
    industry = lead_data.get("industry", "luxury")
    domain = BRAND_DOMAIN_MAP.get(industry, "authichain.com")

    safe_slug = "".join(c if c.isalnum() else "-" for c in slug.lower()).strip("-")
    alias_domain = f"{safe_slug}.{domain}"

    # 1. Cloudflare R2 Upload
    if cf_token and cf_account:
        url = f"https://api.cloudflare.com/client/v4/accounts/{cf_account}/r2/buckets/authichain-microsites/objects/{safe_slug}/index.html"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                await client.put(url, headers={"Authorization": f"Bearer {cf_token}", "Content-Type": "text/html"}, content=generate_microsite_html(lead_data, domain))
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
    project_id = "prj_avIBQb2HRqlvpHE6VN2N2wBlRdgq"
    
    if not token: return False
    
    headers = {"Authorization": f"Bearer {token}"}
    url = f"https://api.vercel.com/v13/deployments"
    
    payload = {
        "name": "authichain-unified",
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
