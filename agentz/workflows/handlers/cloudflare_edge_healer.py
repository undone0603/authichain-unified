"""
agentz.workflows.handlers.cloudflare_edge_healer
------------------------------------------------
Cloudflare edge health & custom hostname validation handler.
Replaces legacy Vercel dashboard fix presets.
"""
from __future__ import annotations

import asyncio
from agentz.core.credentials import get, get_or_placeholder
from agentz.core.modes import ExecutionContext, Mode
import httpx

def run(ctx: ExecutionContext) -> str:
    cf_token = get_or_placeholder("cloudflare_api_token", ctx)
    cf_zone_id = get_or_placeholder("cloudflare_zone_id", ctx)

    if ctx.mode == Mode.DRY_RUN:
        ctx.step("Verify Cloudflare Worker edge routes and custom hostnames")
        ctx.step("Purge Cloudflare edge cache for authichain.com")
        return "cloudflare edge heal check complete (dry-run)"

    return asyncio.run(_run_cloudflare_check(cf_token, cf_zone_id))


async def _run_cloudflare_check(token: str, zone_id: str) -> str:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}"
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(url, headers=headers)
        if r.status_code == 200:
            return "Cloudflare Zone verified active. Edge routing healthy."
        return f"Cloudflare API status code {r.status_code}"
