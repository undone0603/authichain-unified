# Verify worker: evaluate() contract (merged)

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

| id                                | expected decision                          |
| --------------------------------- | ------------------------------------------ |
| `AC:DEMO:VERIFIED` (alias `DEMO`) | `verified`                                 |
| `AC:DEMO:REVOKED`                 | `blocked`                                  |
| `AC:DEMO:EXPIRED`                 | `expired`                                  |
| `VT-26` / `MENDO`                 | `not_found` + `library_page_is_not_a_seal` |
| unknown                           | `not_found`                                |

`source` is `fixture` | `library` | `supabase` | `none`.
`polygon.queried` is always `false`. Contract `0x4da4…72BE` is named, not called.

## What this is not

- Not a physical object on-chain.
- Not GTR. GTR stays unlisted.

## Status

- Founder approved the merge on 27 Sep 2026. Merging to `main` deploys the worker through `deploy-workers.yml`.
- Before the merge, version `8da586dc` was promoted by hand at 14:58Z and rolled back at 15:02Z (see PR #1268 comments).

## Still open

- Whether a real mint plus an RPC read is authorized. That needs `BLOCKCHAIN_PRIVATE_KEY`, which is never pasted in chat. Until then `polygon.queried` stays `false`.
