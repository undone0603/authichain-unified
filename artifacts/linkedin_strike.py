#!/usr/bin/env python3
"""
AuthiChain LinkedIn Autonomous Strike Agent
Posts marketing content to LinkedIn using the unofficial cookie-based API.
Runs daily via GitHub Actions Ghost Traffic Engine.
"""
import os
import sys
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


def run_linkedin_strike():
    session_cookie = os.environ.get("LINKEDIN_SESSION_COOKIE")
    if not session_cookie:
        print("[WARN] No cookie set - dry run mode")
        print(get_post_content())
        sys.exit(0)

    post_content = get_post_content()
    print(f"[INFO] Selected post ({len(post_content)} chars)")
    print(f"[INFO] Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"[DEBUG] Cookie length: {len(session_cookie)}, starts with: {session_cookie[:8]}...")

    session = requests.Session()
    # Set the cookie directly
    session.cookies.set("li_at", session_cookie, domain=".linkedin.com", path="/")
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
    })

    # Step 1: Fetch feed without following redirects to check if cookie is valid
    print("[INFO] Checking session validity...")
    try:
        r = session.get(
            "https://www.linkedin.com/feed/",
            allow_redirects=False,
            timeout=15
        )
        print(f"[INFO] Feed response: status={r.status_code}, location={r.headers.get('Location', 'none')}")
        print(f"[DEBUG] Cookies after feed request: {dict(session.cookies)}")

        if r.status_code in (301, 302, 303):
            loc = r.headers.get("Location", "")
            if "login" in loc or "authwall" in loc or "signup" in loc:
                print(f"[ERROR] Session cookie rejected - redirected to: {loc}")
                sys.exit(1)
            # Some redirects are OK (HTTPS upgrade etc)
            print(f"[INFO] Redirect to: {loc} - following...")
            r = session.get(loc, allow_redirects=True, timeout=15)
            print(f"[INFO] Final URL: {r.url}, status: {r.status_code}")

        if r.status_code == 999:
            print("[ERROR] LinkedIn returned 999 - bot detection triggered")
            sys.exit(1)

    except Exception as e:
        print(f"[ERROR] Feed request failed: {e}")
        sys.exit(1)

    # Step 2: Get CSRF token from cookies
    csrf = session.cookies.get("JSESSIONID")
    if not csrf:
        # Try from response cookies
        csrf = r.cookies.get("JSESSIONID")
    if csrf:
        csrf = csrf.strip('"')
        print(f"[INFO] CSRF token: {csrf[:20]}...")
    else:
        print("[WARN] No JSESSIONID - generating fallback")
        csrf = "ajax:" + "0" * 19

    session.headers.update({
        "csrf-token": csrf,
        "x-li-lang": "en_US",
        "x-li-track": '{"clientVersion":"1.13.10721","osName":"web","timezoneOffset":-5,"timezone":"America/Chicago","deviceFormFactor":"DESKTOP"}',
        "x-restli-protocol-version": "2.0.0",
    })

    # Step 3: Get profile URN
    print("[INFO] Fetching profile...")
    try:
        resp = session.get(
            "https://www.linkedin.com/voyager/api/me",
            headers={"accept": "application/json"},
            timeout=15
        )
        print(f"[INFO] Profile status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"[ERROR] Profile fetch failed: {resp.text[:300]}")
            sys.exit(1)
        data = resp.json()
        urn = data.get("miniProfile", {}).get("entityUrn", "")
        if not urn:
            print(f"[ERROR] No URN in response. Keys: {list(data.keys())}")
            sys.exit(1)
        person_urn = urn.replace("fs_miniProfile", "person")
        print(f"[INFO] Posting as: {person_urn}")
    except Exception as e:
        print(f"[ERROR] Profile request failed: {e}")
        sys.exit(1)

    # Step 4: Post content
    payload = {
        "visibleToGuest": True,
        "externalAudienceProviders": [],
        "commentaryV2": {
            "text": post_content,
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

    try:
        post_resp = session.post(
            "https://www.linkedin.com/voyager/api/contentcreation/normShares",
            json=payload,
            headers={"content-type": "application/json", "accept": "application/json"},
            timeout=15
        )
        print(f"[INFO] Post status: {post_resp.status_code}")
        print(f"[INFO] Post response: {post_resp.text[:300]}")
        if post_resp.status_code in (200, 201):
            print("[SUCCESS] Post published to LinkedIn!")
            print(f"[INFO] Preview: {post_content[:80]}...")
        else:
            print("[ERROR] Post failed")
            sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Post request failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run_linkedin_strike()
