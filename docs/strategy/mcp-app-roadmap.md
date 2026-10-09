# MCP app roadmap

Status as of 2026-10-06. Written against the code, not against intent —
every gap below is quoted from the repo's own comments or return values, so
this file can be checked rather than believed.

The organising rule, which the MCP code already follows and this roadmap
keeps: **an agent is never given an answer that cannot be real.** Shipping a
tool that returns a confident shape over no data is worse than not shipping
it, because the agent cannot tell the difference.

---

## Where the app actually is

**Live and real.** `workers/authichain-com/src/mcp-routes.ts` serves `/mcp`,
`/api/mcp` and `/.well-known/mcp.json`. Five tools. Free, unauthenticated.
Registered with the MCP registry as `io.github.undone0603/authichain`.

| Tool                   | Backed by                                     | Honest?                                                 |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------- |
| `verify_record`        | Real Ed25519 verify + live Polygon RPC read   | Yes — full verdict with reasons                         |
| `dpp_readiness_check`  | 13 cited EU categories, 1 in law              | Yes — states law vs. target                             |
| `get_pricing`          | `plans.ts` / x402                             | Yes — says plans are on hold                            |
| `query_provenance`     | The 4 published `/m/` packs + one desk sample | Partly — real for a published pack, `unknown` otherwise |
| `verify` (legacy x402) | Unbound registry                              | Refuses before settlement                               |

**Shipped in this pass.** Transport conformance (notifications now answer
202 instead of a malformed result; protocol-version negotiation; `ping`;
CORS for `MCP-Protocol-Version` / `Accept`), the `/mcp/install` page, an
operator `.mcpb` bundle, and a fix for `serverInfo` reporting 1.0.0 while
the registry published 1.2.0.

Also in this pass, two claims were made _real_ rather than disclaimed:

- `query_provenance` now resolves the four published microsite packs
  (`published-packs.ts`), so an agent asking about `BAT-2026-001` gets the
  published restatement instead of `unknown`. An id with no published pack
  still returns `unknown` — see G1 for what is still missing.
- The install page shipped a `vscode:mcp/install` button whose URI format
  could not be confirmed against Microsoft's docs (two incompatible shapes
  circulate). Rather than ship a dead button or caveat it, it now uses
  `code --add-mcp`, which Microsoft documents, plus VS Code's real
  `servers` config shape — an `mcpServers` block is silently ignored there.

---

## The honest gaps

These are the claims the surface makes that the data does not yet support.
Each one is sourced.

### G1 — `query_provenance` still has no _registry_ behind it

Partly closed. `queryProvenance()` now resolves the four published
microsite packs, so the ids AuthiChain has actually published answer with
real data. What is still missing is the registry itself: any id outside
those four packs and the `AC-7C2A91E4` desk seed returns
`status: "unknown"`, and the certificates API it points at is still
annotated `state: "404"` with the note _"Public count stays — until this
endpoint answers."_

So the tool is honest but narrow: four published packs is not a registry.
Closing this properly means standing up
`/api/authichain/certificates` and resolving against it. Until then the
`unknown` answer is correct and must not be dressed up — a confident shape
over no row is the one thing this surface must never return.

### G2 — five MCP surfaces, three different tool vocabularies

| Surface                                        | Tools                                                     | Auth               |
| ---------------------------------------------- | --------------------------------------------------------- | ------------------ |
| `workers/authichain-com/src/mcp-routes.ts`     | `verify_record`, `dpp_readiness_check`, …                 | none               |
| `src/app/api/mcp/route.ts`                     | `authichain_verify_product`, `authichain_check_eu_dpp`, … | X-API-Key, metered |
| `mcp/src/index.ts`                             | `verify_product`, `list_qrons`                            | direct Postgres    |
| `workers/authichain-gateway/src/mcp-server.ts` | —                                                         | —                  |
| `workers/_shared/estate-mcp.ts`                | —                                                         | —                  |

The worker accepts both `verify` and `authichain_verify_product` as aliases,
which hides the split rather than closing it. Anyone integrating against the
Next endpoint gets a different contract from anyone integrating against the
live one.

### G3 — the Base NFT claim is not deployable

`baseNft.contract` is `null` with the note _"AuthiChainNFT getCode is empty.
Do not claim Base mint."_ Polygon is real: 16 ACPT NFTs at
`0x4da4D2675e52374639C9c954f4f653887A9972BE`.

### G4 — one published record, and it is not a product

`polygon-anchor-1` is the only id `verify_record` resolves. Its own
`credentialSubject.name` reads _"Protocol demonstration. Not a product, not
a battery passport."_ The production issuer DID is allowlisted in
`ALLOWED_SIGNERS`, so the path for real records exists — nothing has gone
through it publicly.

### G5 — revenue is switched off

`paidPlans.status` is `"on_hold"`. The legacy x402 verify refuses with
`503 registry_not_bound` before settlement — correct behaviour given G1
(no registry to answer from), but it means the agent-pay rail cannot earn.

---

## Roadmap

Ordered by _what unblocks what_, not by effort.

### Phase 1 — make `query_provenance` real, or withdraw it

**G1 is the gate for G5.** The paid rail cannot turn on while there is
nothing to look up, which is exactly why the x402 path refuses today.

Two routes, and the choice is a product decision, not an engineering one:

- **(a) Stand up the registry.** Make
  `/api/authichain/certificates` answer from the `auth_seals` table that
  `src/lib/mcp-tools.ts` already queries. The query exists; the public
  endpoint does not.
- **(b) Withdraw the tool** from `TOOLS` until (a) lands. A client that
  never sees the tool is better served than one that calls it and gets
  `unknown`.

Do (b) the same day if (a) is not imminent. Leaving a hollow tool in
`tools/list` is the one thing in this stack that actively misleads an agent.

### Phase 2 — collapse to one tool registry

Extract the `TOOLS` array and its handlers into a module all surfaces
import, with one canonical name per tool and the `authichain_*` forms kept
as explicit deprecated aliases. Touches live billing in
`src/app/api/mcp/route.ts`, so it is its own PR with its own review.

Exit test: one source file, the install page's table unchanged, and the
Next endpoint answering the same tool names as the worker.

### Phase 3 — publish a real record end to end

Issue one production record through the allowlisted production issuer
(`kid lue84w…`), anchor it, and publish it alongside `polygon-anchor-1`.
That converts G4 from "the path exists" to "the path has been walked", and
gives the install page a showcase that is a product rather than a
demonstration.

Natural candidate: BAT-2026-001, which already has a public restatement
at `/m/bat-2026-001` but no signed record behind it.

### Phase 4 — turn the rail on

Only after Phases 1 and 3. Un-hold `paidPlans`, bind the x402 verify to the
live registry, and let `get_pricing` list a real price. Until then
`get_pricing` correctly says plans are on hold, and should keep saying it.

### Phase 5 — distribution

Submit to the MCP registry listing and the Claude connector directory now
that `server.json` and `serverInfo` agree and the transport is conformant.
Phase 5 is cheap and safe, and does **not** depend on 1–4 — the free
verification tools are genuinely useful on their own, which is the honest
pitch for a directory entry.

---

## What this roadmap will not do

- Put the unlisted grower packs (`content/strainchain/gtr-seeds`,
  `mendo-love-farms`) on a public surface. They are marked
  `"unlisted": true` and hold transcribed customer CoAs.
- Claim a Base mint while `getCode` is empty (G3).
- Report a stored total on a passport. Totals are recomputed at render
  time — see the repo `CLAUDE.md`.
- Present `polygon-anchor-1` as a product.
