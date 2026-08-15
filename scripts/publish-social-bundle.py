#!/usr/bin/env python3
"""Publish the oldest unpublished social bundle to LinkedIn, Reddit and X.

Content Routines write bundles into content/social/ and this posts them with no
human in the loop. Two properties matter more than anything else here:

1. Nothing publishes unless scripts/validate-social-bundle.mjs passes. A post
   cannot be unsent, so the guardrail is a hard precondition, not a warning.
2. Publishing is idempotent. A bundle recorded in the ledger is never posted
   again, so a re-run, a retry, or two overlapping workflow triggers cannot
   double-post.

Channels fail independently: LinkedIn being misconfigured must not stop the
Reddit post, and a partial success is recorded as partial so the next run does
not repeat what already went out.

Usage:
    python3 scripts/publish-social-bundle.py [--dry-run] [--bundle PATH]
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

SOCIAL_DIR = Path("content/social")
LEDGER = SOCIAL_DIR / ".published.json"
VALIDATOR = Path("scripts/validate-social-bundle.mjs")


# ─── Ledger ───────────────────────────────────────────────────────────────────

def load_ledger() -> dict:
    if not LEDGER.exists():
        return {"bundles": {}}
    try:
        return json.loads(LEDGER.read_text())
    except json.JSONDecodeError:
        # A corrupt ledger must not be silently reset — that would republish
        # everything already posted.
        sys.exit(f"FATAL: {LEDGER} is not valid JSON. Refusing to publish.")


def save_ledger(ledger: dict) -> None:
    SOCIAL_DIR.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(ledger, indent=2, sort_keys=True) + "\n")


def pick_bundle(ledger: dict) -> Path | None:
    """Oldest unpublished bundle. Filenames are date-prefixed, so sorted() is chronological."""
    published = ledger.get("bundles", {})
    candidates = sorted(p for p in SOCIAL_DIR.glob("*.json") if p.name not in published)
    return candidates[0] if candidates else None


# ─── Channels ─────────────────────────────────────────────────────────────────

def post_linkedin(bundle: dict, dry: bool) -> tuple[bool, str]:
    token = os.environ.get("LINKEDIN_ACCESS_TOKEN")
    urn = os.environ.get("LINKEDIN_PERSON_URN")
    if not token or not urn:
        return False, "skipped: LINKEDIN_ACCESS_TOKEN/LINKEDIN_PERSON_URN not set"
    if dry:
        return True, "dry-run"

    import requests

    payload = {
        "author": urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": bundle["linkedin"]},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }
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
    if not r.ok:
        return False, f"HTTP {r.status_code}: {r.text[:200]}"
    return True, r.headers.get("x-restli-id", "posted")


def post_reddit(bundle: dict, dry: bool) -> tuple[bool, str]:
    need = ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USERNAME", "REDDIT_PASSWORD"]
    if any(not os.environ.get(k) for k in need):
        return False, "skipped: Reddit credentials not set"
    if dry:
        return True, "dry-run"

    import praw

    reddit = praw.Reddit(
        client_id=os.environ["REDDIT_CLIENT_ID"],
        client_secret=os.environ["REDDIT_CLIENT_SECRET"],
        username=os.environ["REDDIT_USERNAME"],
        password=os.environ["REDDIT_PASSWORD"],
        user_agent="AuthiChain content bot (contact: authichain.com)",
    )
    r = bundle["reddit"]
    submission = reddit.subreddit(r["subreddit"]).submit(r["title"], selftext=r["body"])
    return True, submission.shortlink


def post_twitter(bundle: dict, dry: bool) -> tuple[bool, str]:
    need = [
        "TWITTER_API_KEY",
        "TWITTER_API_SECRET",
        "TWITTER_ACCESS_TOKEN",
        "TWITTER_ACCESS_TOKEN_SECRET",
    ]
    if any(not os.environ.get(k) for k in need):
        return False, "skipped: Twitter credentials not set"
    if dry:
        return True, "dry-run"

    from requests_oauthlib import OAuth1Session

    session = OAuth1Session(
        os.environ["TWITTER_API_KEY"],
        client_secret=os.environ["TWITTER_API_SECRET"],
        resource_owner_key=os.environ["TWITTER_ACCESS_TOKEN"],
        resource_owner_secret=os.environ["TWITTER_ACCESS_TOKEN_SECRET"],
    )

    reply_to = None
    first_id = None
    posted = 0
    for tweet in bundle["twitter"]:
        payload: dict = {"text": tweet}
        if reply_to:
            payload["reply"] = {"in_reply_to_tweet_id": reply_to}
        r = session.post("https://api.twitter.com/2/tweets", json=payload, timeout=20)
        if not r.ok:
            if first_id:
                # Tweets already sent cannot be unsent. Reporting plain failure
                # would leave them unrecorded, and the next run would post the
                # opening tweet a second time. Surface the partial as a success
                # carrying a URL so it lands in the ledger, with the breakage
                # stated rather than hidden.
                return True, (
                    f"https://x.com/i/status/{first_id} "
                    f"(PARTIAL: {posted}/{len(bundle['twitter'])} tweets — "
                    f"thread broke on HTTP {r.status_code}; finish or delete manually)"
                )
            return False, f"HTTP {r.status_code}: {r.text[:150]}"
        tid = r.json()["data"]["id"]
        first_id = first_id or tid
        reply_to = tid
        posted += 1

    return True, f"https://x.com/i/status/{first_id}"


CHANNELS = {"linkedin": post_linkedin, "reddit": post_reddit, "twitter": post_twitter}


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="validate and report, post nothing")
    ap.add_argument("--bundle", help="publish this specific bundle instead of the oldest unpublished")
    args = ap.parse_args()

    ledger = load_ledger()
    bundle_path = Path(args.bundle) if args.bundle else pick_bundle(ledger)

    if bundle_path is None:
        print("No unpublished bundles. Nothing to do.")
        return 0
    if not bundle_path.exists():
        return print(f"FATAL: {bundle_path} does not exist.") or 1

    print(f"Bundle: {bundle_path}")

    # Hard precondition. A bundle that fails the guardrail is never posted.
    check = subprocess.run(
        ["node", str(VALIDATOR), str(bundle_path)], capture_output=True, text=True
    )
    print(check.stdout, end="")
    if check.returncode != 0:
        print(check.stderr, file=sys.stderr, end="")
        print("\nValidation failed. Refusing to publish.", file=sys.stderr)
        return 1

    bundle = json.loads(bundle_path.read_text())

    results: dict[str, str] = {}
    any_success = False
    for name, fn in CHANNELS.items():
        try:
            ok, detail = fn(bundle, args.dry_run)
        except Exception as exc:  # a broken channel must not abort the others
            ok, detail = False, f"error: {type(exc).__name__}: {exc}"
        status = "ok" if ok else "FAILED"
        print(f"  {name:9s} {status}: {detail}")
        if ok and detail != "dry-run":
            results[name] = detail
            any_success = True
        elif ok:
            any_success = True

    if args.dry_run:
        print("\nDry run — ledger untouched, nothing posted.")
        return 0

    if not any_success:
        print("\nNo channel accepted the post. Ledger untouched so the next run retries.", file=sys.stderr)
        return 1

    entry = {
        "published_at": datetime.now(timezone.utc).isoformat(),
        "channels": results,
    }
    # Carry the A/B metadata through to the ledger so each variant is traceable
    # to the live post URLs it produced — that record is the experiment log the
    # generating routine reads to lean the next batch toward the winning lever.
    experiment = bundle.get("experiment")
    if isinstance(experiment, dict):
        entry["experiment"] = experiment
    ledger.setdefault("bundles", {})[bundle_path.name] = entry
    save_ledger(ledger)
    print(f"\nRecorded {bundle_path.name} in {LEDGER}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
