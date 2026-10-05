"""
agentz.core.microsites
---------------------
Microsite Agent: publishes personalized sales pages to Cloudflare.

The root Worker (worker/index.ts, "Microsite KV router") serves
``<slug>.authichain.com`` from the ``MICROSITES_KV`` namespace at key
``<slug>/index.html``. Publishing a microsite is therefore one KV write:
no per-lead DNS, no Vercel, and no deploy. Cloudflare is the only deploy
target (see GEMINI.md and .github/workflows/vercel-deploy-guard.yml).
"""
from __future__ import annotations
import html
import logging
import re
from typing import Dict, Any, Optional
from urllib.parse import quote

import httpx

from agentz.core.credentials import get

logger = logging.getLogger("agentz.microsites")

# MICROSITES_KV binding in the root wrangler.toml. Override with the
# CLOUDFLARE_MICROSITES_KV_NAMESPACE env var if the namespace is ever recreated.
DEFAULT_MICROSITES_KV_NAMESPACE = "a992900da1db4b998af1cdf4eccf550a"

# Subdomains that already serve something real. A lead slug must never claim
# one, or its KV entry would shadow that site in the microsite router.
RESERVED_SLUGS = frozenset({
    "www", "app", "api", "id", "verify", "dashboard", "agentz", "claw",
    "bitcoin-auth", "admin", "mail", "status", "docs", "m",
})

_DNS_LABEL = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")


def microsite_slug(raw: Any) -> Optional[str]:
    """Normalize a lead slug into a safe DNS label, or None if unusable."""
    slug = re.sub(r"[^a-z0-9]+", "-", str(raw or "").lower()).strip("-")[:63].strip("-")
    if not slug or not _DNS_LABEL.match(slug) or slug in RESERVED_SLUGS:
        return None
    return slug


def generate_microsite_html(lead_data: Dict[str, Any]) -> str:
    """Generates a high-fidelity 'Living Digital Twin' HTML page."""
    # Lead fields come from HubSpot and other external sources: escape them so
    # a crafted name cannot inject script into an authichain.com subdomain.
    name = html.escape(str(lead_data.get("name", "Valued Partner")))
    amount = html.escape(str(lead_data.get("amount", "TBD")))

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
    <p>Provisioned autonomously by AgentZ. Blockchain anchored.</p>
    <a href="https://authichain.com" style="color:#00ff88;">INITIALIZE PARTNERSHIP</a>
  </div>
</body>
</html>"""


async def deploy_sales_microsite(lead_data: Dict[str, Any]) -> Optional[str]:
    """
    Publishes a personalized microsite to the MICROSITES_KV namespace.

    Returns the public URL once Cloudflare confirms the write, or None when
    the slug is unusable, credentials are missing, or the write fails. It
    never reports a URL that is not actually live.
    """
    slug = microsite_slug(lead_data.get("slug", "demo"))
    if not slug:
        logger.error(f"Microsite skipped: unusable or reserved slug {lead_data.get('slug')!r}")
        return None

    cf_token = get("cloudflare_api_token", required=False)
    cf_account = get("cloudflare_account", required=False)
    namespace = (
        get("cloudflare_microsites_kv_namespace", required=False)
        or DEFAULT_MICROSITES_KV_NAMESPACE
    )
    if not (cf_token and cf_account):
        logger.error("Microsite skipped: CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not set")
        return None

    key = f"{slug}/index.html"  # matches the router's `${subdomain}${path}` key
    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{cf_account}"
        f"/storage/kv/namespaces/{namespace}/values/{quote(key, safe='')}"
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.put(
                url,
                headers={"Authorization": f"Bearer {cf_token}", "Content-Type": "text/html; charset=UTF-8"},
                content=generate_microsite_html(lead_data).encode("utf-8"),
            )
        if r.status_code != 200 or not r.json().get("success"):
            logger.error(f"Microsite KV write failed for {slug}: HTTP {r.status_code}")
            return None
    except Exception as e:
        logger.error(f"Microsite KV write failed for {slug}: {e}")
        return None

    public_url = f"https://{slug}.authichain.com"
    logger.info(f"Microsite published: {public_url}")
    return public_url
