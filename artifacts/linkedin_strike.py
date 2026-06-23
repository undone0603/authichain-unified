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


def debug_page(page):
    """Dump useful debug info about what's on the page."""
    try:
        url = page.url
        print(f"[DEBUG] Current URL: {url}")
        # Find all buttons and inputs
        buttons = page.evaluate("""
            () => {
                const els = document.querySelectorAll('button, [role=button], input, [contenteditable], div[tabindex]');
                return Array.from(els).slice(0, 20).map(el => ({
                    tag: el.tagName,
                    role: el.getAttribute('role'),
                    aria: el.getAttribute('aria-label'),
                    placeholder: el.getAttribute('placeholder') || el.getAttribute('data-placeholder'),
                    text: el.innerText ? el.innerText.substring(0, 60) : '',
                    cls: el.className ? el.className.substring(0, 80) : ''
                }));
            }
        """)
        print("[DEBUG] Interactive elements found:")
        for b in buttons:
            print(f"  {b}")
    except Exception as e:
        print(f"[DEBUG] Could not get debug info: {e}")


def click_start_post(page):
    """Click the Start a post element using JS evaluation as primary method."""
    # Strategy 1: JavaScript DOM search - find anything with 'post' text
    try:
        clicked = page.evaluate("""
            () => {
                // Try to find share box trigger by various means
                const candidates = [
                    ...document.querySelectorAll('button'),
                    ...document.querySelectorAll('[role="button"]'),
                    ...document.querySelectorAll('[tabindex="0"]'),
                ];
                for (const el of candidates) {
                    const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').toLowerCase();
                    if (text.includes('start a post') || text.includes('share a post') || text.includes('create a post')) {
                        el.click();
                        return true;
                    }
                }
                // Try data-placeholder
                const placeholder = document.querySelector('[data-placeholder]');
                if (placeholder) { placeholder.click(); return 'placeholder'; }
                // Try share box
                const shareBox = document.querySelector('.share-box, .share-creation-state, .share-box-feed-entry');
                if (shareBox) { shareBox.click(); return 'sharebox'; }
                return false;
            }
        """)
        if clicked:
            print(f"[INFO] Clicked start-post via JS evaluation: {clicked}")
            return True
    except Exception as e:
        print(f"[DEBUG] JS click failed: {e}")

    # Strategy 2: CSS selectors
    selectors = [
        ".share-box-feed-entry__top-bar",
        ".share-box-feed-entry__trigger",
        "[data-placeholder='Start a post']",
        ".share-creation-state__placeholder",
        ".share-box__open",
        "div.feed-shared-update-v2__description",
        "button.share-box-feed-entry__top-bar",
        "[aria-label*='post']",
        "[aria-label*='Post']",
    ]
    for selector in selectors:
        try:
            el = page.locator(selector).first
            if el.is_visible(timeout=2000):
                el.click()
                print(f"[INFO] Clicked start-post via CSS: {selector}")
                return True
        except Exception:
            continue

    # Strategy 3: text-based
    for text in ["Start a post", "Share a post", "What's on your mind"]:
        try:
            el = page.get_by_text(text, exact=False).first
            if el.is_visible(timeout=2000):
                el.click()
                print(f"[INFO] Clicked start-post via text: {text}")
                return True
        except Exception:
            continue

    return False


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
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
            ]
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
        )
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
            page.goto("https://www.linkedin.com/feed/", timeout=60000, wait_until="networkidle")
            page.wait_for_timeout(5000)

            if "login" in page.url or "authwall" in page.url or "checkpoint" in page.url:
                print(f"[ERROR] Session cookie invalid. Redirected to: {page.url}")
                debug_page(page)
                sys.exit(1)

            print("[INFO] Logged in successfully. Inspecting page...")
            debug_page(page)

            # Dismiss modals
            try:
                page.locator("button[aria-label='Dismiss']").first.click(timeout=3000)
                page.wait_for_timeout(1000)
            except PlaywrightTimeoutError:
                pass

            page.wait_for_timeout(2000)

            if not click_start_post(page):
                print("[ERROR] Could not find Start a post button with any selector.")
                debug_page(page)
                page.screenshot(path="/tmp/linkedin_error.png")
                sys.exit(1)

            page.wait_for_timeout(3000)
            print("[INFO] Post dialog opened. Finding editor...")

            editor = None
            for sel in ["div.ql-editor", "[contenteditable='true'][role='textbox']", "[contenteditable='true']"]:
                try:
                    el = page.locator(sel).first
                    el.wait_for(timeout=8000)
                    if el.is_visible():
                        editor = el
                        print(f"[INFO] Found editor via: {sel}")
                        break
                except Exception:
                    continue

            if not editor:
                print("[ERROR] Could not find post editor.")
                debug_page(page)
                page.screenshot(path="/tmp/linkedin_error.png")
                sys.exit(1)

            editor.click()
            page.wait_for_timeout(500)
            page.keyboard.type(post_content, delay=15)
            page.wait_for_timeout(2000)
            print("[INFO] Content typed. Submitting post...")

            post_btn = page.get_by_role("button", name="Post", exact=True)
            post_btn.wait_for(timeout=10000)
            post_btn.click()
            page.wait_for_timeout(5000)

            print("[SUCCESS] Post published to LinkedIn!")
            print(f"[INFO] Content: {post_content[:80]}...")

        except PlaywrightTimeoutError as e:
            print(f"[ERROR] Timeout: {e}")
            debug_page(page)
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
