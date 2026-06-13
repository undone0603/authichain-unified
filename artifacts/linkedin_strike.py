#!/usr/bin/env python3
"""
Ghost Traffic Engine - LinkedIn Strike v2
Autonomous LinkedIn outreach using Playwright + session cookie auth.
Targets supply chain, pharma, luxury goods, and government procurement leads.
v2: Improved bot-detection evasion with human-like delays and navigation.
"""

import os
import sys
import json
import random
import asyncio
from datetime import datetime
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SESSION_COOKIE = os.environ.get("LINKEDIN_SESSION_COOKIE", "")

if not SESSION_COOKIE:
    print("[WARN] LINKEDIN_SESSION_COOKIE is not set. Running in dry-run mode.")
    DRY_RUN = True
else:
    DRY_RUN = False

SEARCH_QUERIES = [
    "supply chain compliance manager",
    "pharmaceutical track and trace director",
    "government procurement officer",
    "product authentication anti-counterfeiting",
    "cannabis compliance METRC",
]

MESSAGE_TEMPLATES = [
    "Hi {name}, I'm building AuthiChain - a blockchain-based product authentication "
    "platform for supply chain compliance. Would love to connect and share how we're "
    "helping teams solve traceability challenges.",
    "Hi {name}, saw your work in supply chain verification - we're launching AuthiChain, "
    "a QR-based provenance platform. Think it aligns with what you're working on. Worth a quick chat?",
    "Hi {name}, GovChain (our govt-facing auth layer) is gaining traction with procurement "
    "teams. Given your background, thought you'd find it relevant. Open to connecting?",
]

MAX_CONNECTIONS_PER_RUN = 8
DELAY_MIN = 5
DELAY_MAX = 12
PAGE_LOAD_WAIT = 8


def log(msg):
    ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}")


def rand_delay(mn=None, mx=None):
    return random.uniform(mn or DELAY_MIN, mx or DELAY_MAX)


def pick_message(name):
    return random.choice(MESSAGE_TEMPLATES).format(name=name)


async def safe_goto(page, url, retries=2):
    """Navigate with retry on interruption errors."""
    for attempt in range(retries):
        try:
            await page.goto(url, wait_until="load", timeout=30000)
            await asyncio.sleep(rand_delay(3, 6))
            # If redirected to /hp or authwall, session may be rate-limited
            if "/hp" in page.url or "authwall" in page.url or "login" in page.url:
                log(f"Redirected to {page.url} - LinkedIn rate-limiting or session issue")
                await asyncio.sleep(rand_delay(10, 20))
                if attempt < retries - 1:
                    log("Retrying...")
                    continue
                return False
            return True
        except PlaywrightTimeoutError:
            log(f"Timeout on {url}, attempt {attempt + 1}")
            await asyncio.sleep(rand_delay(5, 10))
        except Exception as e:
            if "interrupted by another navigation" in str(e):
                log(f"Navigation interrupted on attempt {attempt + 1}, waiting...")
                await asyncio.sleep(rand_delay(8, 15))
                if attempt < retries - 1:
                    continue
            else:
                log(f"Navigation error: {e}")
            return False
    return False


async def run_strike():
    log("Ghost Traffic Engine v2 starting...")
    results = {"sent": 0, "skipped": 0, "errors": 0, "leads": []}

    if DRY_RUN:
        log("DRY RUN MODE - no browser launched.")
        for query in SEARCH_QUERIES:
            log(f"[DRY RUN] Would search: '{query}'")
        log(f"[DRY RUN] Would send up to {MAX_CONNECTIONS_PER_RUN} connection requests.")
        return results

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
            ]
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
            locale="en-US",
            timezone_id="America/Detroit",
        )

        # Remove automation fingerprint
        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        """)

        # Inject session cookie
        await context.add_cookies([{
            "name": "li_at",
            "value": SESSION_COOKIE,
            "domain": ".linkedin.com",
            "path": "/",
            "httpOnly": True,
            "secure": True,
        }])

        page = await context.new_page()

        # Verify session
        log("Loading LinkedIn feed to verify session...")
        ok = await safe_goto(page, "https://www.linkedin.com/feed/")
        if not ok or "authwall" in page.url or "login" in page.url:
            log("ERROR: Session invalid or expired. Update LINKEDIN_SESSION_COOKIE.")
            await browser.close()
            sys.exit(1)

        log(f"Session valid. Current URL: {page.url}")
        log(f"Warming up - waiting {PAGE_LOAD_WAIT}s before starting searches...")
        await asyncio.sleep(PAGE_LOAD_WAIT)

        connections_sent = 0

        for query in SEARCH_QUERIES:
            if connections_sent >= MAX_CONNECTIONS_PER_RUN:
                break

            log(f"Searching for: '{query}'")
            encoded = query.replace(" ", "%20")
            search_url = (
                f"https://www.linkedin.com/search/results/people/"
                f"?keywords={encoded}"
                f"&origin=GLOBAL_SEARCH_HEADER"
                f"&network=%5B%22S%22%2C%22O%22%5D"
            )

            ok = await safe_goto(page, search_url)
            if not ok:
                log(f"Skipping '{query}' - could not load search results")
                results["skipped"] += 1
                # Cool down between failed searches
                await asyncio.sleep(rand_delay(15, 25))
                continue

            log(f"Search loaded. URL: {page.url}")

            # Brief scroll to appear human
            await page.mouse.wheel(0, random.randint(200, 500))
            await asyncio.sleep(rand_delay(2, 4))

            try:
                connect_buttons = await page.query_selector_all('button[aria-label*="Connect"]')
                log(f"Found {len(connect_buttons)} Connect buttons")

                for btn in connect_buttons[:3]:  # Max 3 per query to avoid rate limits
                    if connections_sent >= MAX_CONNECTIONS_PER_RUN:
                        break

                    try:
                        name = "there"
                        try:
                            card = await btn.evaluate_handle("el => el.closest('li')")
                            name_el = await card.query_selector("span[aria-hidden='true']")
                            if name_el:
                                raw = await name_el.inner_text()
                                name = raw.strip().split(" ")[0]
                        except Exception:
                            pass

                        # Scroll button into view before clicking
                        await btn.scroll_into_view_if_needed()
                        await asyncio.sleep(rand_delay(1, 2))
                        await btn.click()
                        await asyncio.sleep(rand_delay(2, 4))

                        note_btn = await page.query_selector('button[aria-label="Add a note"]')
                        if note_btn:
                            await note_btn.click()
                            await asyncio.sleep(rand_delay(1, 2))
                            msg = pick_message(name)
                            textarea = await page.query_selector('textarea[name="message"]')
                            if textarea:
                                await textarea.click()
                                await asyncio.sleep(0.5)
                                for char in msg:
                                    await textarea.type(char, delay=random.randint(30, 80))
                            send_btn = await page.query_selector('button[aria-label="Send now"]')
                            if send_btn:
                                await send_btn.click()
                        else:
                            send_btn = await page.query_selector('button[aria-label="Send now"]')
                            if send_btn:
                                await send_btn.click()

                        await asyncio.sleep(rand_delay(DELAY_MIN, DELAY_MAX))
                        connections_sent += 1
                        results["sent"] += 1
                        results["leads"].append({"name": name, "query": query})
                        log(f"Sent to '{name}' via [{query}] ({connections_sent}/{MAX_CONNECTIONS_PER_RUN})")

                    except Exception as e:
                        log(f"Error on connection: {e}")
                        results["errors"] += 1
                        try:
                            dismiss = await page.query_selector('button[aria-label="Dismiss"]')
                            if dismiss:
                                await dismiss.click()
                        except Exception:
                            pass
                        await asyncio.sleep(rand_delay(3, 6))
                        continue

            except Exception as e:
                log(f"Error processing search '{query}': {e}")
                results["errors"] += 1

            # Inter-query cooldown to avoid rate limits
            cooldown = rand_delay(20, 35)
            log(f"Cooling down {cooldown:.0f}s before next query...")
            await asyncio.sleep(cooldown)

        await browser.close()

    log(f"Strike complete. Sent={results['sent']} Skipped={results['skipped']} Errors={results['errors']}")
    log(f"Leads: {json.dumps(results['leads'], indent=2)}")
    return results


if __name__ == "__main__":
    asyncio.run(run_strike())
