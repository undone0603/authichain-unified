#!/usr/bin/env python3
"""
AuthiChain LinkedIn Autonomous Strike Agent
Uses curl_cffi to impersonate Chrome TLS fingerprint, bypassing LinkedIn bot detection.
Hits Voyager API directly with li_at session cookie.
Runs daily via GitHub Actions Ghost Traffic Engine.
"""
import os
import sys
import hashlib
from datetime import datetime

try:
    from curl_cffi import requests
except ImportError:
    import requests  # fallback

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
        print("[WARN] No cookie - dry run mode")
        print(get_post_content())
        sys.exit(0)

    post_content = get_post_content()
    print(f"[INFO] Post selected ({len(post_content)} chars)")
    print(f"[INFO] Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"[DEBUG] Cookie: length={len(session_cookie)}, prefix={session_cookie[:6]}")

    # Derive CSRF token
    csrf = "ajax:" + hashlib.md5(session_cookie.encode()).hexdigest()[:16]
    print(f"[INFO] CSRF: {csrf}")

    # Use curl_cffi Session with Chrome impersonation to bypass TLS fingerprinting
    try:
        session = requests.Session(impersonate="chrome120")
    except Exception:
        # fallback if curl_cffi unavailable
        import requests as req
        session = req.Session()

    cookies = {
        "li_at": session_cookie,
        "JSESSIONID": f'"{csrf}"',
    }

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "csrf-token": csrf,
        "x-li-lang": "en_US",
        "x-li-track": '{"clientVersion":"1.13.10721","osName":"web","timezoneOffset":-5,"timezone":"America/Chicago","deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
        "x-restli-protocol-version": "2.0.0",
        "x-li-page-instance": "urn:li:page:d_flagship3_feed;0",
        "Referer": "https://www.linkedin.com/feed/",
        "Origin": "https://www.linkedin.com",
    }

    # Step 1: Get profile URN
    print("[INFO] Fetching profile...")
    try:
        resp = session.get(
            "https://www.linkedin.com/voyager/api/me",
            cookies=cookies,
            headers=headers,
            timeout=20,
            allow_redirects=False,
        )
        print(f"[INFO] /me status: {resp.status_code}")
        print(f"[DEBUG] /me response: {resp.text[:500]}")

        if resp.status_code in (301, 302):
            loc = resp.headers.get("Location", "")
            print(f"[ERROR] Redirected to: {loc} - auth failed")
            sys.exit(1)

        if resp.status_code == 401:
            print("[ERROR] 401 Unauthorized - invalid cookie or CSRF")
            sys.exit(1)

        if resp.status_code != 200:
            print(f"[ERROR] Unexpected status: {resp.status_code}")
            sys.exit(1)

        data = resp.json()
        urn = None
        if "miniProfile" in data:
            urn = data["miniProfile"].get("entityUrn", "")
        elif "elements" in data and data["elements"]:
            urn = data["elements"][0].get("miniProfile", {}).get("entityUrn", "")

        if not urn:
            print(f"[ERROR] No URN found. Keys: {list(data.keys())}")
            sys.exit(1)

        person_urn = urn.replace("fs_miniProfile", "person")
        print(f"[INFO] Author: {person_urn}")

    except Exception as e:
        print(f"[ERROR] Profile fetch error: {e}")
        sys.exit(1)

    # Step 2: Post via ugcPosts
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

    post_headers = {**headers, "content-type": "application/json", "X-Restli-Method": "CREATE"}

    try:
        pr = session.post(
            "https://www.linkedin.com/voyager/api/ugcPosts",
            json=ugc_payload,
            cookies=cookies,
            headers=post_headers,
            timeout=20,
        )
        print(f"[INFO] ugcPosts status: {pr.status_code}")
        print(f"[INFO] ugcPosts response: {pr.text[:400]}")

        if pr.status_code in (200, 201):
            print("[SUCCESS] Post published to LinkedIn!")
            print(f"[INFO] Preview: {post_content[:80]}...")
            return
    except Exception as e:
        print(f"[WARN] ugcPosts failed: {e}")

    # Fallback: normShares
    print("[INFO] Trying normShares...")
    norm_payload = {
        "visibleToGuest": True,
        "commentaryV2": {"text": post_content, "inferredLocale": "en_US", "attributesV2": []},
        "origin": "MEMBER_SHARES",
        "author": person_urn,
        "lifecycleState": "PUBLISHED",
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"}
    }
    try:
        nr = session.post(
            "https://www.linkedin.com/voyager/api/contentcreation/normShares",
            json=norm_payload,
            cookies=cookies,
            headers=post_headers,
            timeout=20,
        )
        print(f"[INFO] normShares status: {nr.status_code}")
        print(f"[INFO] normShares response: {nr.text[:400]}")
        if nr.status_code in (200, 201):
            print("[SUCCESS] Post published via normShares!")
        else:
            print("[ERROR] All endpoints failed")
            sys.exit(1)
    except Exception as e:
        print(f"[ERROR] normShares failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run_linkedin_strike()
