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
FIPS / HIPAA / PCI claims, no FedRAMP-authorization claims ("FedRAMP compliant /
ready / certified"), and no "government-grade / government compliant" claims —
the claim forms are banned, but a factual sentence that merely names FedRAMP or
NIST as requirements to evaluate with the customer still passes. No
"quantum-resistant" (Ed25519 is not) or QR "L4"
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

### Webhook Zap wiring

A concrete Zapier build for the webhook fan-out. `post_webhook` POSTs the whole
validated bundle to `SOCIAL_WEBHOOK_URL` with `Content-Type: application/json`
and, when set, `Authorization: Bearer <SOCIAL_WEBHOOK_TOKEN>`. Nested objects
flatten with a double-underscore in the Catch Hook; the `twitter` array exposes
each element as a line item.

Incoming field reference:

| Payload path | Catch Hook key |
| --- | --- |
| `linkedin` | `linkedin` |
| `reddit.subreddit` | `reddit__subreddit` (bare name, no `r/`) |
| `reddit.title` | `reddit__title` |
| `reddit.body` | `reddit__body` |
| `twitter[0..2]` | `twitter` (items `twitter[]`) |
| `experiment.*` | `experiment__campaign` / `__variant` / `__hypothesis` (metadata — ignore or log) |

Steps:

1. **Webhooks by Zapier → Catch Hook.** Copy the generated URL → that is
   `SOCIAL_WEBHOOK_URL`. Configure the field-picker by sending one test POST
   (run the publisher against a throwaway bundle, or paste a sample payload).
2. **(Optional) Filter by Zapier** — enforce `SOCIAL_WEBHOOK_TOKEN`: continue
   only if the `Authorization` header exactly matches `Bearer <token>`.
3. **LinkedIn → Create Share Update**: Comment ← `linkedin`; Visible To ← `Anyone`.
4. **Reddit → Submit Text Post**: Subreddit ← `reddit__subreddit`;
   Title ← `reddit__title`; Text ← `reddit__body`.
5. **Twitter/X → Create Tweet ×3** (thread, three separate actions):
   Tweet 1 ← `twitter[0]`; Tweet 2 ← `twitter[1]`, In Reply To ← Tweet 1's ID;
   Tweet 3 ← `twitter[2]`, In Reply To ← Tweet 2's ID.

Two gotchas:

- **LinkedIn Create Share Update can silently no-op** — return success with an
  empty body and not post. Zapier Autoreplay only retries hard errors, not
  empty-success, so spot-check LinkedIn after the first live runs (or add a
  Delay + a recent-share read to confirm). Reddit and X return real IDs, so
  they self-verify.
- **X thread order matters**: each Create Tweet returns the ID the next step
  replies to; if Tweet 1 fails, Tweets 2–3 error on the missing reply ID (that
  run just doesn't post the thread — acceptable, the next run retries).

## Ledger

`.published.json` is the idempotency record — a bundle listed there is never
reposted. Never hand-edit or delete it to force a repost; that double-posts.
