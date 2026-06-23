#!/usr/bin/env python3
"""
AuthiChain LinkedIn Autonomous Strike Agent
Posts marketing content to LinkedIn using the unofficial cookie-based API.
Much more reliable than Playwright - no browser automation detection.
Runs daily via GitHub Actions Ghost Traffic Engine.
"""
import os
import sys
import json
import requests
from datetime import datetime

# ── Content Pool ──────────────────────────────────────────────────────────────
POSTS = [
    """Product authentication is broken.

Counterfeit goods cost brands $4.5 trillion/year globally. Consumers can't trust what they buy. Supply chains are opaque.

AuthiChain fixes this with:
\u2022 AI-powered GPT-4 Vision verification
\u2022 NFT certificates on Polygon (tamper-proof)
\u2022 QR-based scan-to-verify for any product
\u2022 Multi-tenant SaaS across 10 verticals

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
\u2022 QR code generation + tracking
\u2022 NFT certificates on Polygon blockchain
\u2022 AI verification (GPT-4 Vision)
\u2022 Supply chain audit trail
\u2022 White-label for your brand

Built on Next.js + Cloudflare Workers + Supabase.

Get started free: https://authichain-unified.vercel.app

#ProductVerification #Blockchain #Web3 #SaaS #Startup""",
    """Most brands discover their products are being counterfeited AFTER the damage is done.

AuthiChain gives you real-time alerts the moment a fake is detected.
\u2022 Tamper-evident QR codes
\u2022 Blockchain-anchored provenance
\u2022 AI-powered visual verification
\u2022 Dashboard analytics across all SKUs

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
    day_index = datetime.now().timetuple().tm_yday
    return POSTS[day_index % len(POSTS)]


def get_profile_urn(session):
    """Get the current user's profile URN."""
    resp = session.get(
        "https://www.linkedin.com/voyager/api/me",
        headers={"accept": "application/json"},
    )
    print(f"[INFO] Profile fetch status: {resp.status_code}")
    if resp.status_code != 200:
        print(f"[ERROR] Could not fetch profile: {resp.text[:200]}")
        return None
    data = resp.json()
    # Extract the mini profile URN
    try:
        urn = data["miniProfile"]["entityUrn"]
        print(f"[INFO] Got profile URN: {urn}")
        return urn
    except (KeyError, TypeError) as e:
        print(f"[ERROR] Could not parse profile URN: {e}")
        print(f"[DEBUG] Response keys: {list(data.keys())}")
        return None


def post_to_linkedin(session, author_urn, content):
    """Post content using LinkedIn Voyager API."""
    # Convert urn:li:fs_miniProfile:XXX -> urn:li:person:XXX
    person_urn = author_urn.replace("fs_miniProfile", "person")
    print(f"[INFO] Posting as: {person_urn}")

    payload = {
        "visibleToGuest": True,
        "externalAudienceProviders": [],
        "commentaryV2": {
            "text": content,
            "inferredLocale": "en_US",
            "attributesV2": []
        },
        "origin": "MEMBER_SHARES",
        "allowedCommentersScope": "ALL",
        "author": person_urn,
        "lifecycleState": "PUBLISHED",
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
    }

    resp = session.post(
        "https://www.linkedin.com/voyager/api/contentcreation/normShares",
        json=payload,
        headers={
            "accept": "application/json",
            "content-type": "application/json",
            "x-restli-protocol-version": "2.0.0",
        }
    )
    print(f"[INFO] Post response status: {resp.status_code}")
    print(f"[INFO] Post response: {resp.text[:300]}")
    return resp.status_code in (200, 201)


def run_linkedin_strike():
    session_cookie = os.environ.get("LINKEDIN_SESSION_COOKIE")
    if not session_cookie:
        print("[WARN] LINKEDIN_SESSION_COOKIE not set. Dry-run mode.")
        print(get_post_content())
        print("[SUCCESS] Dry run complete.")
        sys.exit(0)

    post_content = get_post_content()
    print(f"[INFO] Selected post ({len(post_content)} chars)")
    print(f"[INFO] Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    session = requests.Session()
    session.cookies.set("li_at", session_cookie, domain=".linkedin.com")
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "csrf-token": "ajax:0000000000000000000",
        "x-li-lang": "en_US",
        "x-li-track": '{"clientVersion":"1.13.10721","mpVersion":"1.13.10721","osName":"web","timezoneOffset":-5,"timezone":"America/Chicago","deviceFormFactor":"DESKTOP","mpName":"voyager-web","displayDensity":1,"displayWidth":1920,"displayHeight":1080}',
    })

    print("[INFO] Fetching CSRF token from LinkedIn...")
    # First, hit the feed to get JSESSIONID and csrf token from cookies
    try:
        r = session.get("https://www.linkedin.com/feed/", timeout=30)
        print(f"[INFO] Feed fetch status: {r.status_code}, final URL: {r.url}")
        if "authwall" in r.url or "login" in r.url or r.status_code == 999:
            print(f"[ERROR] Session invalid - got redirected to: {r.url}")
            sys.exit(1)
        # Extract CSRF from cookies
        csrf = session.cookies.get("JSESSIONID", domain="www.linkedin.com")
        if csrf:
            csrf = csrf.strip('"')
            session.headers.update({"csrf-token": csrf})
            print(f"[INFO] Got CSRF token: {csrf[:20]}...")
        else:
            print("[WARN] No JSESSIONID found, using default csrf")
    except Exception as e:
        print(f"[ERROR] Failed to fetch feed: {e}")
        sys.exit(1)

    author_urn = get_profile_urn(session)
    if not author_urn:
        print("[ERROR] Could not get author URN, aborting.")
        sys.exit(1)

    success = post_to_linkedin(session, author_urn, post_content)
    if success:
        print("[SUCCESS] Post published to LinkedIn!")
        print(f"[INFO] Content preview: {post_content[:80]}...")
    else:
        print("[ERROR] Failed to publish post.")
        sys.exit(1)


if __name__ == "__main__":
    run_linkedin_strike()
