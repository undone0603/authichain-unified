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


def post_telegram(bundle: dict, dry: bool) -> tuple[bool, str]:
    """Zero-OAuth channel. A BotFather token + a channel id the bot administers
    is the entire setup — no OAuth redirect, no account password. Posts the
    already-validated linkedin copy so nothing bypasses the guardrail."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat = os.environ.get("TELEGRAM_CHANNEL_ID")
    if not token or not chat:
        return False, "skipped: TELEGRAM_BOT_TOKEN/TELEGRAM_CHANNEL_ID not set"
    if dry:
        return True, "dry-run"

    import requests

    r = requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={"chat_id": chat, "text": bundle["linkedin"]},
        timeout=20,
    )
    if not r.ok:
        return False, f"HTTP {r.status_code}: {r.text[:200]}"
    return True, f"telegram message {r.json().get('result', {}).get('message_id', 'posted')}"


def post_webhook(bundle: dict, dry: bool) -> tuple[bool, str]:
    """Universal fan-out. Instead of holding LinkedIn/Reddit/X OAuth tokens as
    GitHub secrets, POST the validated bundle to one webhook — a Zapier Zap,
    Make scenario, n8n flow, or Buffer relay that the owner authorises once in
    that tool's UI and which fans the post out to every platform. Collapses
    three OAuth flows and eight secrets into a single URL."""
    url = os.environ.get("SOCIAL_WEBHOOK_URL")
    if not url:
        return False, "skipped: SOCIAL_WEBHOOK_URL not set"
    if dry:
        return True, "dry-run"

    import requests

    headers = {"Content-Type": "application/json"}
    secret = os.environ.get("SOCIAL_WEBHOOK_TOKEN")
    if secret:
        # Optional shared secret so the receiving flow can reject forged posts.
        headers["Authorization"] = f"Bearer {secret}"
    r = requests.post(url, json=bundle, headers=headers, timeout=20)
    if not r.ok:
        return False, f"HTTP {r.status_code}: {r.text[:200]}"
    return True, f"delivered to webhook (HTTP {r.status_code})"


# Direct platform channels first, then the credential-light alternatives. Every
# channel skips cleanly when its secrets are absent, so an operator can wire up
# whichever subset they want — one webhook, or Telegram, or the raw OAuth apps.
CHANNELS = {
    "linkedin": post_linkedin,
    "reddit": post_reddit,
    "twitter": post_twitter,
    "telegram": post_telegram,
    "webhook": post_webhook,
}


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
    any_hard_failure = False  # a channel that had credentials and still failed
    for name, fn in CHANNELS.items():
        try:
            ok, detail = fn(bundle, args.dry_run)
        except Exception as exc:  # a broken channel must not abort the others
            ok, detail = False, f"error: {type(exc).__name__}: {exc}"
        if ok:
            status = "ok"
            any_success = True
            if detail != "dry-run":
                results[name] = detail
        elif detail.startswith("skipped:"):
            status = "skipped"  # no credentials — not a failure, just not wired up
        else:
            status = "FAILED"
            any_hard_failure = True
        print(f"  {name:9s} {status}: {detail}")

    if args.dry_run:
        print("\nDry run — ledger untouched, nothing posted.")
        return 0

    if not any_success:
        if any_hard_failure:
            print("\nNo channel accepted the post. Ledger untouched so the next run retries.", file=sys.stderr)
            return 1
        # Every channel skipped for missing credentials. That is the expected
        # pre-launch state (OAuth secrets not set yet), not an error — idle
        # cleanly so the pipeline does not red-CI on every push. The bundle
        # stays unpublished and will go out once credentials are configured.
        print("\nAll channels skipped — no social credentials configured. Nothing to publish yet.")
        return 0

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
