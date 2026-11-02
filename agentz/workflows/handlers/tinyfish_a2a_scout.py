"""Read-only TinyFish discovery of open A2A agent ecosystems.

This handler discovers public projects; it does not post, contact maintainers,
create leads, buy access, deploy, mutate external resources, or treat search
snippets as authenticated endorsements.
"""
from __future__ import annotations

import asyncio
import json
import os
from urllib.parse import urlsplit

from agentz.core.modes import ExecutionContext, Mode

QUERY = "Agent2Agent A2A open-source agent interoperability tools repositories 2026"
MAX_URLS = 5


def _public_references(response: dict) -> list[str]:
    """Extract only public HTTPS source URLs from server data, never instructions."""
    candidates = []
    structured = response.get("structured_content")
    if isinstance(structured, dict):
        candidates.append(structured)
    for part in response.get("content", []):
        if isinstance(part, str):
            try:
                data = json.loads(part)
            except json.JSONDecodeError:
                continue
            if isinstance(data, dict):
                candidates.append(data)

    urls: list[str] = []
    for data in candidates:
        for item in data.get("results", []):
            if not isinstance(item, dict):
                continue
            url = item.get("url")
            if not isinstance(url, str):
                continue
            parsed = urlsplit(url)
            if parsed.scheme != "https" or not parsed.hostname:
                continue
            if parsed.username or parsed.password:
                continue
            if url not in urls:
                urls.append(url)
            if len(urls) >= MAX_URLS:
                return urls
    return urls


def run(ctx: ExecutionContext) -> str:
    if ctx.mode == Mode.DRY_RUN:
        return "TinyFish A2A scout would run one public read-only search; no network call."
    # A long-running daemon must never open interactive OAuth or consume an
    # unapproved metered browser product. The key must be bound on its host.
    if not os.getenv("TINYFISH_API_KEY", "").strip():
        raise RuntimeError("TinyFish scout blocked: TINYFISH_API_KEY missing")

    from agentz.integrations.tinyfish_mcp import call_tinyfish

    response = asyncio.run(call_tinyfish("search", [QUERY]))
    if not response.get("ok"):
        raise RuntimeError("TinyFish scout search failed")

    refs = _public_references(response)
    # Only log URLs; do not echo raw untrusted page content or credentials.
    if ctx.verbose:
        for url in refs:
            print(f"   SOURCE (unverified): {url}")
    return f"TinyFish A2A scout read-only search succeeded; public references={len(refs)}; no outreach or payments"
