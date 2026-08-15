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

## Ledger

`.published.json` is the idempotency record — a bundle listed there is never
reposted. Never hand-edit or delete it to force a repost; that double-posts.
