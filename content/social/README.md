# Autonomous social bundles

The `claude/social-bundle-*` Content Routine writes bundles into this directory
and pushes them. `content-routine-pr.yml` opens and auto-merges a content-only
PR, then `content-publish.yml` posts the oldest unpublished bundle to LinkedIn,
Reddit and X — **with no human in the loop.**

Nothing publishes unless `scripts/validate-social-bundle.mjs` passes. A post
cannot be unsent, so the validator is a hard precondition, not advice. Run it
locally before committing:

```
node scripts/validate-social-bundle.mjs content/social/<file>.json
```

## Bundle schema

One JSON file per bundle, named `YYYY-MM-DD-<campaign>-<variant>.json` (the
publisher posts the oldest filename first, so the date prefix orders the queue):

```jsonc
{
  "linkedin": "post body, ≤3000 chars",
  "reddit": {
    "subreddit": "supplychain",          // bare name, no "r/", 2–21 [A-Za-z0-9_]
    "title": "≤300 chars",
    "body": "must contain: Disclosure: I work on this project."
  },
  "twitter": ["tweet 1", "tweet 2", "tweet 3"],  // exactly 3, each ≤280

  // Optional — drives A/B. Recorded verbatim into .published.json alongside
  // the live post URLs, so every variant is traceable to what it produced.
  "experiment": {
    "campaign": "dpp-deadline",          // shared across the A and B variant
    "variant": "a",                      // "a" | "b"
    "hypothesis": "deadline-led hook beats capability-led hook on click-through"
  }
}
```

## What the validator forbids (non-exhaustive)

No percentages, currency figures, large-number or customer-count claims, latency
claims, or absolutes ("100% scannable", "guaranteed"). No SOC 2 / ISO 27001 /
FIPS / HIPAA / PCI claims. No "quantum-resistant" (Ed25519 is not) or QR "L4"
(levels are L/M/Q/H). Links may only point at `authichain.com`, `qron.space`,
`govchain.us`, `strainchain.io`, and only at routes that actually resolve —
`authichain.com` has real deep links (`/verify`, `/dpp`, `/pricing`, `/book`,
…); the brand domains resolve only at `/`.

## A/B method

- Each campaign ships two variants, `a` and `b`, that differ in **one** lever
  (hook, CTA, or framing) so the difference is attributable.
- CTAs carry UTM params on an allowed path, e.g.
  `authichain.com/verify?utm_source=linkedin&utm_medium=social&utm_campaign=<campaign>&utm_content=<variant>`.
  (The validator matches the host + path only, so the query string passes and
  still reaches the funnel tracker at runtime.)
- The publisher records `{campaign, variant, hypothesis, channels:{…urls}}` per
  bundle in `.published.json`. That ledger is the experiment log: the generating
  routine reads it to see which campaigns/variants already went out and, as
  engagement data accrues, leans the next batch toward the winning lever.

## Publishing channels — pick the least painful credential

`content-publish.yml` runs every channel; each **skips cleanly when its secrets
are absent**, so wire up whichever subset you want. In rising order of setup pain:

| Channel | Secrets | Setup | OAuth? |
| --- | --- | --- | --- |
| **Telegram** | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID` | BotFather gives a token in ~1 min; add the bot as a channel admin | none |
| **Webhook fan-out** | `SOCIAL_WEBHOOK_URL` (+ optional `SOCIAL_WEBHOOK_TOKEN`) | One Zapier Zap / Make scenario / n8n flow, triggered by a Catch Hook, that posts to LinkedIn + Reddit + X. Connect those accounts **once in that tool's UI** | handled by Zapier/Make, not here |
| LinkedIn (direct) | `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_URN` | `scripts/linkedin-oauth-setup.mjs` | interactive OAuth |
| Reddit (direct) | `REDDIT_CLIENT_ID/SECRET/USERNAME/PASSWORD` | Reddit "script" app | password grant |
| X/Twitter (direct) | `TWITTER_API_KEY/SECRET`, `TWITTER_ACCESS_TOKEN/SECRET` | X developer app | OAuth 1.0a |

The **webhook** is the recommended autonomous path: it collapses three OAuth
flows and eight secrets into a single URL, and the platform authorisation lives
in Zapier/Make (a UI connect, not a token you mint and rotate by hand). The
publisher POSTs the validated bundle JSON (`linkedin`, `reddit`, `twitter`,
`experiment`) to that URL; your flow maps each field to its platform. **Telegram**
is the zero-OAuth quick win — a real channel live from a bot token alone. Both
still post only content that passed `validate-social-bundle.mjs`.

Load any of these with `set-social-secrets.yml`.

## Ledger

`.published.json` is the idempotency record — a bundle listed there is never
reposted. Never hand-edit or delete it to force a repost; that double-posts.
