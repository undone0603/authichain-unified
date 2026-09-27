# Draft-branch verify work — DO NOT MERGE / DO NOT DEPLOY

PR: https://github.com/undone0603/authichain-unified/pull/1268
Branch: `feat/verify-evaluate-wire`
Date: 27 Sep 2026

## What landed
Worker `/verify` and `/api/verify` on this branch return the kernel contract:

```json
{ "decision", "vector", "reasons", "unknowns", "depthUsed" }
```

No `trust_score`. No simulated 5-agent votes on this path.

## Demo ids (fixtures, not a live mint)

| id | expected decision |
|---|---|
| `AC:DEMO:VERIFIED` (alias `DEMO`) | `verified` |
| `AC:DEMO:REVOKED` | `blocked` |
| `AC:DEMO:EXPIRED` | `expired` |
| `VT-26` / `MENDO` | `not_found` + `library_page_is_not_a_seal` |
| unknown | `not_found` |

`source` is `fixture` | `library` | `supabase` | `none`.
`polygon.queried` is always `false`. Contract `0x4da4…72BE` is named, not called.

## What this is not
- Not a physical object on-chain.
- Not a production deploy. Cloudflare production branch is `main` with previews disabled.
- Not GTR. GTR stays unlisted.
- Not a merge to main.

## Next (founder review)
1. Local `wrangler dev` in `workers/authichain-verify-worker` and hit the three fixture ids.
2. Decide whether a real mint + RPC read is authorized (needs `BLOCKCHAIN_PRIVATE_KEY`, not in chat).
3. Merge only after that review.
