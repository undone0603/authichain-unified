"""Read-only TinyFish discovery of open A2A agent ecosystems.

This handler discovers public projects; it does not post, contact maintainers,
create leads, buy access, deploy, mutate external resources, or treat search
snippets as authenticated endorsements.
"""
from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit

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
        items = data.get("results")
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            url = item.get("url")
            if not isinstance(url, str):
                continue
            parsed = urlsplit(url)
            if parsed.scheme != "https" or not parsed.hostname:
                continue
            if parsed.username or parsed.password or len(url) > 2048:
                continue
            if any(ord(char) < 32 or ord(char) == 127 for char in url):
                continue
            # Apply the same local/private-host guard as the MCP fetch adapter.
            from agentz.integrations.tinyfish_mcp import public_url
            try:
                public_url(url)
            except ValueError:
                continue
            # Remove fragments and query strings, which may carry private tokens.
            source = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))
            if source not in urls:
                urls.append(source)
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

    try:
        response = asyncio.run(call_tinyfish("search", [QUERY]))
    except Exception:
        # The registry runner records traceback/error text. Never let a
        # transport exception containing headers or tokens reach that log.
        raise RuntimeError("TinyFish scout transport failed") from None
    if not response.get("ok"):
        raise RuntimeError("TinyFish scout search failed")

    refs = _public_references(response)
    # Store a bounded local checkpoint for reproducible audit. A search source
    # is not a verified partnership, and this is not an AuthiChain attestation.
    ctx.save_state({
        "tool": "tinyfish.search",
        "observed_at_utc": datetime.now(timezone.utc).isoformat(),
        "query": QUERY,
        "sources": refs,
        "verification": "unverified",
        "external_side_effects": "none",
    })
    # Only log URLs; do not echo raw untrusted page content or credentials.
    if ctx.verbose:
        for url in refs:
            print(f"   SOURCE (unverified): {url}")
    return f"TinyFish A2A scout read-only search succeeded; public references={len(refs)}; no outreach or payments"
