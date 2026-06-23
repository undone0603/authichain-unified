#!/usr/bin/env python3
"""
AuthiChain LinkedIn Autonomous Strike Agent
Posts via LinkedIn Voyager API using li_at session cookie.
Skips feed fetch (causes redirect loop) - goes straight to API.
Runs daily via GitHub Actions Ghost Traffic Engine.
"""
import os
import sys
import re
import requests
from datetime import datetime

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


def extract_csrf_from_cookie(li_at):
    """
    LinkedIn's JSESSIONID/csrf is derived from the li_at cookie.
    When we can't fetch it from the page, we use the li_at value
    directly as the ajax: prefixed CSRF token format.
    """
    # Extract numeric portion from li_at for csrf
    # li_at format: AQEDxxxxxxxx (base64-like)
    # Try to get csrf from the cookie value hash
    import hashlib
    h = hashlib.md5(li_at.encode()).hexdigest()[:16]
    return f"ajax:{h}"


def run_linkedin_strike():
    session_cookie = os.environ.get("LINKEDIN_SESSION_COOKIE")
    if not session_cookie:
        print("[WARN] No cookie - dry run mode")
        print(get_post_content())
        sys.exit(0)

    post_content = get_post_content()
    print(f"[INFO] Post selected ({len(post_content)} chars)")
    print(f"[INFO] Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"[DEBUG] Cookie: length={len(session_cookie)}, prefix={session_cookie[:6]}")

    # Build CSRF token - use li_at-derived value
    csrf = extract_csrf_from_cookie(session_cookie)
    print(f"[INFO] Using CSRF: {csrf}")

    session = requests.Session()
    session.cookies.set("li_at", session_cookie, domain=".linkedin.com", path="/")
    # Also set JSESSIONID as CSRF
    session.cookies.set("JSESSIONID", f'"{csrf}"', domain="www.linkedin.com", path="/")

    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "csrf-token": csrf,
        "x-li-lang": "en_US",
        "x-li-track": '{"clientVersion":"1.13.10721","osName":"web","timezoneOffset":-5,"timezone":"America/Chicago","deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
        "x-restli-protocol-version": "2.0.0",
        "x-li-page-instance": "urn:li:page:d_flagship3_feed;0",
        "Referer": "https://www.linkedin.com/feed/",
        "Origin": "https://www.linkedin.com",
    })

    # Step 1: Get profile URN directly from Voyager API
    print("[INFO] Fetching profile from Voyager API...")
    try:
        resp = session.get(
            "https://www.linkedin.com/voyager/api/me",
            timeout=20
        )
        print(f"[INFO] Profile status: {resp.status_code}")
        print(f"[DEBUG] Profile response: {resp.text[:400]}")

        if resp.status_code == 401 or resp.status_code == 403:
            print("[ERROR] Auth failed - cookie or CSRF rejected")
            sys.exit(1)

        if resp.status_code != 200:
            print(f"[ERROR] Unexpected status {resp.status_code}")
            sys.exit(1)

        data = resp.json()
        # Try different response structures
        urn = None
        if "miniProfile" in data:
            urn = data["miniProfile"].get("entityUrn", "")
        elif "elements" in data:
            urn = data["elements"][0].get("miniProfile", {}).get("entityUrn", "")

        if not urn:
            print(f"[ERROR] No URN. Response keys: {list(data.keys())}")
            sys.exit(1)

        person_urn = urn.replace("fs_miniProfile", "person")
        print(f"[INFO] Author URN: {person_urn}")

    except Exception as e:
        print(f"[ERROR] Profile fetch failed: {e}")
        sys.exit(1)

    # Step 2: Create the post via UGC API
    print("[INFO] Publishing post...")
    ugc_payload = {
        "author": person_urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentaryV2": {
                    "text": post_content,
                    "inferredLocale": "en_US",
                    "attributes": []
                },
                "shareMediaCategory": "NONE"
            }
        },
        "visibility": {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
    }

    try:
        post_resp = session.post(
            "https://www.linkedin.com/voyager/api/ugcPosts",
            json=ugc_payload,
            headers={
                "content-type": "application/json",
                "X-Restli-Method": "CREATE",
            },
            timeout=20
        )
        print(f"[INFO] UGC post status: {post_resp.status_code}")
        print(f"[INFO] UGC response: {post_resp.text[:400]}")

        if post_resp.status_code in (200, 201):
            print("[SUCCESS] Post published to LinkedIn!")
            print(f"[INFO] Preview: {post_content[:80]}...")
        else:
            # Try normShares fallback
            print("[INFO] Trying normShares fallback...")
            norm_payload = {
                "visibleToGuest": True,
                "commentaryV2": {
                    "text": post_content,
                    "inferredLocale": "en_US",
                    "attributesV2": []
                },
                "origin": "MEMBER_SHARES",
                "author": person_urn,
                "lifecycleState": "PUBLISHED",
                "visibility": {
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                }
            }
            fb = session.post(
                "https://www.linkedin.com/voyager/api/contentcreation/normShares",
                json=norm_payload,
                timeout=20
            )
            print(f"[INFO] normShares status: {fb.status_code}")
            print(f"[INFO] normShares response: {fb.text[:400]}")
            if fb.status_code in (200, 201):
                print("[SUCCESS] Post published via normShares!")
            else:
                print("[ERROR] Both endpoints failed")
                sys.exit(1)

    except Exception as e:
        print(f"[ERROR] Post failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run_linkedin_strike()
