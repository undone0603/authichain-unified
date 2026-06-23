#!/usr/bin/env python3
"""
AuthiChain LinkedIn Autonomous Strike Agent
Autonomously posts marketing content to LinkedIn using session cookie auth.
Runs daily via GitHub Actions Ghost Traffic Engine.
"""

import os
import sys
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# ── Content Pool ──────────────────────────────────────────────────────────────
POSTS = [
    """Product authentication is broken.

Counterfeit goods cost brands $4.5 trillion/year globally. Consumers can't trust what they buy. Supply chains are opaque.

AuthiChain fixes this with:
- AI-powered GPT-4 Vision verification
- NFT certificates on Polygon (tamper-proof)
- QR-based scan-to-verify for any product
- Multi-tenant SaaS across 10 verticals

Start authenticating your products for free: https://authichain-unified.vercel.app

#ProductAuthentication #Blockchain #SupplyChain #Web3 #SaaS""",

    """The counterfeiting industry is worth $4.5 trillion.

Every fake product sold kills brand trust, endangers consumers, and destroys margins.

We built AuthiChain to end this.

One QR code. Instant blockchain verification. Powered by GPT-4 Vision AI.

Free tier available: https://authichain-unified.vercel.app

#AuthiChain #ProductAuthentication #QRCode #NFT #AI #Startups""",

    """AuthiChain is live.

If you manufacture, brand, or distribute physical products - you need product authentication.

Here's what we offer:
- QR code generation + tracking
- NFT certificates on Polygon blockchain
- AI verification (GPT-4 Vision)
- Supply chain audit trail
- White-label for your brand

Built on Next.js + Cloudflare Workers + Supabase.

Get started free: https://authichain-unified.vercel.app

#ProductVerification #Blockchain #Web3 #SaaS #Startup""",

    """Most brands discover their products are being counterfeited AFTER the damage is done.

AuthiChain gives you real-time alerts the moment a fake is detected.

- Tamper-evident QR codes
- Blockchain-anchored provenance
- AI-powered visual verification
- Dashboard analytics across all SKUs

Protect your brand now: https://authichain-unified.vercel.app

#BrandProtection #AntiCounterfeit #SupplyChain #Blockchain""",

    """Cannabis. Pharmaceuticals. Luxury goods. Electronics. Apparel.

Every industry has a counterfeiting problem.

AuthiChain is the multi-tenant authentication platform built for all of them.

10 industry verticals. One unified API. Autonomous revenue pipelines.

Verify products at scale: https://authichain-unified.vercel.app

#StrainChain #Cannabis #Pharma #LuxuryGoods #ProductAuthentication #Web3""",
]


def get_post_content():
    """Select post based on day of year for daily rotation."""
    day_index = datetime.now().timetuple().tm_yday
    return POSTS[day_index % len(POSTS)]


def run_linkedin_strike():
    session_cookie = os.environ.get("LINKEDIN_SESSION_COOKIE")

    if not session_cookie:
        print("[WARN] LINKEDIN_SESSION_COOKIE not set. Running in dry-run mode.")
        print("[DRY RUN] Would post:")
        print(get_post_content())
        print("\n[SUCCESS] Dry run complete.")
        sys.exit(0)

    post_content = get_post_content()
    print(f"[INFO] Selected post ({len(post_content)} chars)")
    print(f"[INFO] Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
        )

        # Inject LinkedIn session cookie
        context.add_cookies([{
            "name": "li_at",
            "value": session_cookie,
            "domain": ".linkedin.com",
            "path": "/",
            "httpOnly": True,
            "secure": True,
        }])

        page = context.new_page()

        try:
            print("[INFO] Navigating to LinkedIn feed...")
            page.goto("https://www.linkedin.com/feed/", timeout=60000, wait_until="domcontentloaded")
            page.wait_for_timeout(4000)

            # Check if logged in
            if "login" in page.url or "authwall" in page.url or "checkpoint" in page.url:
                print(f"[ERROR] Session cookie invalid/expired. Redirected to: {page.url}")
                sys.exit(1)

            print("[INFO] Logged in successfully. Looking for Start a post button...")

            # Close any modal dialogs that may appear
            try:
                page.locator("button[aria-label='Dismiss']").first.click(timeout=3000)
                page.wait_for_timeout(1000)
            except PlaywrightTimeoutError:
                pass

            # Click 'Start a post' - use the text-based button selector
            start_post = page.get_by_role("button", name="Start a post")
            start_post.wait_for(timeout=15000)
            start_post.click()
            page.wait_for_timeout(3000)

            print("[INFO] Post dialog opened. Typing content...")

            # Find the content editor in the modal
            editor = page.locator("div.ql-editor")
            if not editor.is_visible():
                editor = page.locator("[contenteditable='true'][role='textbox']")
            if not editor.is_visible():
                editor = page.locator("[contenteditable='true']").first

            editor.wait_for(timeout=10000)
            editor.click()
            page.wait_for_timeout(500)

            # Type the post content
            page.keyboard.type(post_content, delay=15)
            page.wait_for_timeout(2000)

            print("[INFO] Content typed. Submitting post...")

            # Click the Post button
            post_btn = page.get_by_role("button", name="Post", exact=True)
            post_btn.wait_for(timeout=10000)
            post_btn.click()
            page.wait_for_timeout(5000)

            print("[SUCCESS] Post published to LinkedIn!")
            print(f"[INFO] Content: {post_content[:80]}...")

        except PlaywrightTimeoutError as e:
            print(f"[ERROR] Timeout: {e}")
            page.screenshot(path="/tmp/linkedin_error.png")
            sys.exit(1)
        except Exception as e:
            print(f"[ERROR] Failed to post: {e}")
            page.screenshot(path="/tmp/linkedin_error.png")
            sys.exit(1)
        finally:
            browser.close()


if __name__ == "__main__":
    run_linkedin_strike()
