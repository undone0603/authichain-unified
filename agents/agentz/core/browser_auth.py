"""
agentz.core.browser_auth
------------------------
Inject session credentials into a Playwright browser context so
browser-use Agent prompts never need to contain raw tokens.

Usage:
    from playwright.async_api import async_playwright
    from agentz.core.browser_auth import apply_browser_auth

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        await apply_browser_auth(context, ["linkedin", "reddit"])
        # Now the agent operates as already-logged-in
        page = await context.new_page()
        ...

Why this exists:
    browser-use Agent passes the task prompt to an LLM. If the
    prompt contains raw cookies/tokens, they're at risk of leaking
    into LLM provider logs. This module pre-authenticates the
    browser context BEFORE the agent ever touches it, so the agent
    can drive a logged-in session without ever seeing the secret.
"""
from __future__ import annotations

from typing import Iterable

from agentz.core.credentials import get


# Each profile defines: cookies to set, optional default headers,
# and the URL pattern that scopes the cookie.
PROFILES: dict[str, dict] = {
    "linkedin": {
        "cred_key":    "linkedin_session",
        "cookie_name": "li_at",
        "domain":      ".linkedin.com",
        "path":        "/",
        "secure":      True,
        "http_only":   True,
        "same_site":   "None",
    },
    "reddit": {
        "cred_key":    "reddit_session",
        "cookie_name": "reddit_session",
        "domain":      ".reddit.com",
        "path":        "/",
        "secure":      True,
        "http_only":   True,
        "same_site":   "Lax",
    },
    "polygon": {
        "cred_key":    "polygon_session",
        "cookie_name": "session",
        "domain":      ".polygon.technology",
        "path":        "/",
        "secure":      True,
        "http_only":   True,
        "same_site":   "Lax",
    },
    "google": {
        "cred_key":    "google_session",
        "cookie_name": "SID",
        "domain":      ".google.com",
        "path":        "/",
        "secure":      True,
        "http_only":   True,
        "same_site":   "None",
    },
}


async def apply_browser_auth(
    context, profiles: Iterable[str], strict: bool = False
) -> dict[str, str]:
    """
    Inject cookies for each named profile into a Playwright BrowserContext.

    Returns: {profile: status} where status is "ok" | "missing" | "error: ..."
    If strict=True, raises on the first missing credential.
    """
    results: dict[str, str] = {}
    cookies_to_add = []

    for profile in profiles:
        spec = PROFILES.get(profile)
        if not spec:
            results[profile] = "error: unknown profile"
            if strict:
                raise KeyError(f"Unknown browser auth profile: {profile}")
            continue

        try:
            value = get(spec["cred_key"], required=strict)
        except RuntimeError:
            results[profile] = "missing"
            continue

        if not value:
            results[profile] = "missing"
            continue

        cookies_to_add.append({
            "name":     spec["cookie_name"],
            "value":    value,
            "domain":   spec["domain"],
            "path":     spec["path"],
            "secure":   spec["secure"],
            "httpOnly": spec["http_only"],
            "sameSite": spec["same_site"],
        })
        results[profile] = "ok"

    if cookies_to_add:
        await context.add_cookies(cookies_to_add)

    return results


def auth_status_summary(results: dict[str, str]) -> str:
    """Human-readable summary, safe to log."""
    ok      = [p for p, s in results.items() if s == "ok"]
    missing = [p for p, s in results.items() if s == "missing"]
    errors  = {p: s for p, s in results.items() if s.startswith("error")}
    parts = []
    if ok:      parts.append(f"authed: {', '.join(ok)}")
    if missing: parts.append(f"missing: {', '.join(missing)}")
    if errors:  parts.append(f"errors: {errors}")
    return " | ".join(parts) or "no profiles applied"
