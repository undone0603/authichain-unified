#!/usr/bin/env python3
"""
Ghost Traffic Engine - LinkedIn Strike
Autonomous LinkedIn outreach using Playwright + session cookie auth.
Targets supply chain, pharma, luxury goods, and government procurement leads.
"""

import os
import sys
import json
import random
import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SESSION_COOKIE = os.environ.get("LINKEDIN_SESSION_COOKIE", "")

if not SESSION_COOKIE:
    print("[WARN] LINKEDIN_SESSION_COOKIE is not set. Running in dry-run mode.")
    DRY_RUN = True
else:
    DRY_RUN = False

# Target search queries for AuthiChain / GovChain / StrainChain ICP
SEARCH_QUERIES = [
    "supply chain compliance manager",
    "pharmaceutical track and trace",
    "government procurement director",
    "product authentication anti-counterfeiting",
    "cannabis compliance METRC",
]

MESSAGE_TEMPLATES = [
    "Hi {name}, I'm building AuthiChain — a blockchain-based product authentication "
    "platform for supply chain compliance. Would love to connect and share how we're "
    "helping teams solve traceability challenges.",
    "Hi {name}, saw your work in supply chain verification — we're launching AuthiChain, "
    "a QR-based provenance platform. Think it aligns with what you're working on. Worth a quick chat?",
    "Hi {name}, GovChain (our govt-facing auth layer) is gaining traction with procurement "
    "teams. Given your background, thought you'd find it relevant. Open to connecting?",
]

MAX_CONNECTIONS_PER_RUN = 10
DELAY_MIN = 3  # seconds between actions
DELAY_MAX = 8


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def log(msg: str):
    ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}")


def random_delay():
    return random.uniform(DELAY_MIN, DELAY_MAX)


def pick_message(name: str) -> str:
    template = random.choice(MESSAGE_TEMPLATES)
    return template.format(name=name)


# ---------------------------------------------------------------------------
# Core automation
# ---------------------------------------------------------------------------
async def run_strike():
    log("Ghost Traffic Engine starting...")
    results = {"sent": 0, "skipped": 0, "errors": 0, "leads": []}

    if DRY_RUN:
        log("DRY RUN MODE — no browser will be launched. Simulating strike.")
        for i, query in enumerate(SEARCH_QUERIES):
            log(f"[DRY RUN] Would search LinkedIn for: '{query}'")
        log(f"[DRY RUN] Would send up to {MAX_CONNECTIONS_PER_RUN} connection requests.")
        log("Dry run complete. Set LINKEDIN_SESSION_COOKIE secret to enable live mode.")
        return results

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
        )

        # Inject session cookie to bypass login
        await context.add_cookies([
            {
                "name": "li_at",
                "value": SESSION_COOKIE,
                "domain": ".linkedin.com",
                "path": "/",
                "httpOnly": True,
                "secure": True,
            }
        ])

        page = await context.new_page()

        # Verify session is valid
        log("Verifying LinkedIn session...")
        await page.goto("https://www.linkedin.com/feed/", wait_until="domcontentloaded")
        await asyncio.sleep(random_delay())

        if "authwall" in page.url or "login" in page.url:
            log("ERROR: Session cookie is invalid or expired. Please update LINKEDIN_SESSION_COOKIE secret.")
            await browser.close()
            sys.exit(1)

        log("Session valid. Proceeding with strike...")
        connections_sent = 0

        for query in SEARCH_QUERIES:
            if connections_sent >= MAX_CONNECTIONS_PER_RUN:
                break

            log(f"Searching for: '{query}'")
            search_url = (
                f"https://www.linkedin.com/search/results/people/"
                f"?keywords={query.replace(' ', '%20')}"
                f"&network=%5B%22S%22%2C%22O%22%5D"
            )
            await page.goto(search_url, wait_until="domcontentloaded")
            await asyncio.sleep(random_delay())

            # Find Connect buttons
            try:
                connect_buttons = await page.query_selector_all(
                    'button[aria-label*="Connect"]'
                )
                log(f"Found {len(connect_buttons)} Connect buttons for '{query}'")

                for btn in connect_buttons:
                    if connections_sent >= MAX_CONNECTIONS_PER_RUN:
                        break

                    try:
                        # Get name from nearby element
                        name = "there"
                        try:
                            card = await btn.evaluate_handle(
                                "el => el.closest('li')"
                            )
                            name_el = await card.query_selector(
                                "span[aria-hidden='true']"
                            )
                            if name_el:
                                raw = await name_el.inner_text()
                                name = raw.strip().split(" ")[0]
                        except Exception:
                            pass

                        await btn.click()
                        await asyncio.sleep(random_delay())

                        # Check for "Add a note" modal
                        note_btn = await page.query_selector(
                            'button[aria-label="Add a note"]'
                        )
                        if note_btn:
                            await note_btn.click()
                            await asyncio.sleep(1)
                            message = pick_message(name)
                            textarea = await page.query_selector(
                                'textarea[name="message"]'
                            )
                            if textarea:
                                await textarea.fill(message)
                            send_btn = await page.query_selector(
                                'button[aria-label="Send now"]'
                            )
                            if send_btn:
                                await send_btn.click()
                        else:
                            send_btn = await page.query_selector(
                                'button[aria-label="Send now"]'
                            )
                            if send_btn:
                                await send_btn.click()

                        await asyncio.sleep(random_delay())
                        connections_sent += 1
                        results["sent"] += 1
                        results["leads"].append({"name": name, "query": query})
                        log(f"Connection request sent to '{name}' [{query}] ({connections_sent}/{MAX_CONNECTIONS_PER_RUN})")

                    except Exception as e:
                        log(f"Error on connection attempt: {e}")
                        results["errors"] += 1
                        # Dismiss any open modal
                        try:
                            dismiss = await page.query_selector(
                                'button[aria-label="Dismiss"]'
                            )
                            if dismiss:
                                await dismiss.click()
                        except Exception:
                            pass
                        continue

            except Exception as e:
                log(f"Error searching '{query}': {e}")
                results["errors"] += 1
                continue

        await browser.close()

    log(f"Strike complete. Sent: {results['sent']}, Skipped: {results['skipped']}, Errors: {results['errors']}")
    log(f"Leads: {json.dumps(results['leads'], indent=2)}")
    return results


if __name__ == "__main__":
    asyncio.run(run_strike())
