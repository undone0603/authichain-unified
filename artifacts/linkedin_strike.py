#!/usr/bin/env python3
"""
AuthiChain LinkedIn Autonomous Strike Agent
============================================
Posts daily AuthiChain content to LinkedIn via the OFFICIAL LinkedIn API
(https://api.linkedin.com/v2/ugcPosts) using an OAuth 2.0 access token.

Why this was rewritten
----------------------
The previous version hit LinkedIn's *private* /voyager API with a raw `li_at`
session cookie and a CSRF token fabricated as md5(cookie). That approach:
  • violates LinkedIn's ToS and can get the account restricted/banned,
  • breaks the moment the session cookie expires — exactly the failure the
    Ghost Traffic Engine hit ("/me status: 302 ... auth failed"), and
  • can never reliably POST because LinkedIn's CSRF/JSESSIONID is a separate
    server-issued value that cannot be derived from `li_at`.

It now uses the same proven, compliant mechanism as the LinkedIn job in
.github/workflows/marketing-autonomous.yml: an OAuth access token
(LINKEDIN_ACCESS_TOKEN) + the author URN (LINKEDIN_PERSON_URN). Mint/refresh
these with scripts/linkedin-oauth-setup.mjs.

Exit semantics (mirrors marketing-autonomous.yml):
  • Credentials NOT configured  -> exit 0 (nothing to do; graceful skip).
  • Configured but API rejects   -> exit 1 (real failure; rotate the token).
"""
import os
import sys
from datetime import datetime

import requests

POSTS = [
    """Product authentication is broken.

Counterfeit goods cost brands $4.5 trillion/year globally. Consumers can't trust what they buy. Supply chains are opaque.

AuthiChain fixes this with:
• AI-powered GPT-4 Vision verification
• NFT certificates on Polygon (tamper-proof)
• QR-based scan-to-verify for any product
• Multi-tenant SaaS across 10 verticals

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
• QR code generation + tracking
• NFT certificates on Polygon blockchain
• AI verification (GPT-4 Vision)
• Supply chain audit trail
• White-label for your brand

Built on Next.js + Cloudflare Workers + Supabase.

Get started free: https://authichain-unified.vercel.app

#ProductVerification #Blockchain #Web3 #SaaS #Startup""",
    """Most brands discover their products are being counterfeited AFTER the damage is done.

AuthiChain gives you real-time alerts the moment a fake is detected.
• Tamper-evident QR codes
• Blockchain-anchored provenance
• AI-powered visual verification
• Dashboard analytics across all SKUs

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
    """Rotate through the post deck by day-of-year so each daily run differs."""
    day_index = datetime.now().timetuple().tm_yday
    return POSTS[day_index % len(POSTS)]


def run_linkedin_strike():
    token = os.environ.get("LINKEDIN_ACCESS_TOKEN")
    urn = os.environ.get("LINKEDIN_PERSON_URN")
    dry_run = os.environ.get("DRY_RUN", "false").lower() == "true"

    post_content = get_post_content()
    print(f"[INFO] Post selected ({len(post_content)} chars)")
    print(f"[INFO] Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Missing credentials is NOT a failure — there's simply nothing to publish.
    # Exit 0 so the autonomous run stays green (matches marketing-autonomous.yml).
    if not token or not urn:
        print("[WARN] LINKEDIN_ACCESS_TOKEN / LINKEDIN_PERSON_URN not configured — skipping live post.")
        print("[WARN] Mint an OAuth token with scripts/linkedin-oauth-setup.mjs, then set both as repo secrets.")
        print("[INFO] Post that WOULD have been published:")
        print(post_content)
        sys.exit(0)

    if dry_run:
        print("[DRY RUN] Would publish the above post via api.linkedin.com/v2/ugcPosts:")
        print(post_content)
        sys.exit(0)

    payload = {
        "author": urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": post_content},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }

    print("[INFO] Publishing via api.linkedin.com/v2/ugcPosts ...")
    try:
        r = requests.post(
            "https://api.linkedin.com/v2/ugcPosts",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0",
            },
            json=payload,
            timeout=20,
        )
    except Exception as e:
        print(f"[ERROR] LinkedIn post request failed: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"[INFO] LinkedIn API status: {r.status_code}")
    if r.status_code in (200, 201):
        print(f"[SUCCESS] Post published! id={r.headers.get('x-restli-id', '')}")
        print(f"[INFO] Preview: {post_content[:80]}...")
        sys.exit(0)

    # Configured but rejected — surface clearly and fail so the token gets rotated.
    print(f"[ERROR] LinkedIn rejected the post: {r.text[:400]}", file=sys.stderr)
    if r.status_code == 401:
        print("[WARN] Access token expired/invalid — refresh via scripts/linkedin-oauth-setup.mjs.", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    run_linkedin_strike()
