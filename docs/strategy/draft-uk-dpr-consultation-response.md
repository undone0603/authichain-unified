# Draft response — UK Call for Evidence: Digital Product Record Policy

**Status: DRAFT — not submitted.** Prepared 2026-08-26 for review before anyone submits it.

**Consultation:** https://www.gov.uk/government/calls-for-evidence/call-for-evidence-digital-product-record-policy
**Closes:** 11:59pm, 21 September 2026.

## Why this draft is incomplete by design

This session could not reach gov.uk or the secondary sources describing it in detail — this
sandbox's network egress is blocked for those domains (`WebFetch` returned `EGRESS_BLOCKED` for
`www.gov.uk`, `constructionleadershipcouncil.co.uk`, and `dig.watch`). What follows is built from
`WebSearch` summaries only, which describe the consultation's general topic areas (implementation
priorities, business costs, supply-chain readiness, consumer impacts, sustainability,
interoperability, unique product identifiers, and verification/data-collection costs) but not the
exact numbered questions or the submission mechanism (online form vs. email vs. postal).

**Before this goes anywhere, someone needs to:**
1. Open the actual gov.uk page and get the real question list and submission method.
2. Decide who is submitting this and under what name/capacity — a consultation response is a
   public-record document attributable to whoever signs it.
3. Cut anything below that doesn't fit the actual questions, and answer the ones this draft
   doesn't cover.

I did not invent citation numbers, adoption figures, or claims not already stated in this repo's
`protocol/` directory. Where I don't know something, it says so.

## Suggested framing (map onto whichever question covers "interoperability" / "verification
standards" / "what technical approaches should the government consider")

> A domestic digital product record policy will need a way for any party — not just the
> registering business or an approved partner — to check that a record is authentic and current,
> without needing to trust a specific vendor's platform. We'd point to `AuthiChain`'s published,
> Apache-2.0-licensed verification specification as one concrete example of a design pattern worth
> considering:
>
> - **Records are W3C Verifiable Credentials** (aligned to the same `VCDM 2.0` work the EU and W3C
>   are already converging on), signed with Ed25519 and canonicalised per RFC 8785, so a record's
>   authenticity can be checked with nothing but the record and the issuer's public key — no
>   registry lookup or account required at verification time.
> - **Item identity uses GS1 Digital Link**, so it composes with the barcode/2D-code
>   infrastructure the Sunrise 2027 transition is already putting on UK retail packaging (e.g.
>   Tesco's April 2026 full-range rollout), rather than inventing a parallel identifier scheme.
> - **A verifier returns one of three fixed outcomes** (`verified`, `valid-unanchored`,
>   `invalid`) with no partial-credit score, specifically so "verified" cannot be diluted into a
>   marketing figure — a failure mode we've seen concretely (see below).
> - **Conformance is independently checkable**: a public 28-fixture test suite that any
>   implementation, in any language, can be run against, with the suite itself validated against
>   deliberately broken implementations so a passing result means something.
>
> We'd flag two limitations plainly, since a policy built on this pattern should account for them
> rather than assume otherwise: this class of specification proves an issuer signed a statement,
> not that the statement is true (garbage-in problems live above the verification layer); and
> revocation of a compromised signing key is not yet part of the published v0.1 specification.
>
> Full spec: https://github.com/undone0603/authichain-unified/blob/main/protocol/SPEC.md
> Reference verifier and conformance suite:
> https://github.com/undone0603/authichain-unified/tree/main/protocol

## On "what happened when this wasn't done properly" (if a question asks about risks / what to
avoid)

> Worth naming directly: this repository previously published a public-facing "verified" listing
> that anchored real brand names to a **testnet** (not production) blockchain, and displayed at
> least one malformed transaction hash as if it were a valid one. Both defects are now fixed and
> are permanent regression tests in the conformance suite (`anchor-testnet-rejected`,
> `anchor-tx-truncated`) — cited here not to relitigate it, but because it's a concrete, verifiable
> illustration of the failure mode a DPR policy should design against: a verification claim that
> looks authoritative but was never checked against a mainnet record. A policy that doesn't
> specify how "verified" is allowed to be displayed leaves room for exactly this.

## What this draft deliberately does NOT claim

- No adoption numbers, customer counts, or market-size figures for AuthiChain — none exist to
  cite honestly.
- No claim that this spec is used, endorsed, or recognised by GS1, W3C, the EU, or any named
  standards body. It is not, as of this writing.
- No certification claim beyond "a public conformance suite exists and can be run by anyone."

## Next steps

1. Fetch the real gov.uk page (from a machine that can reach it) and get the actual question
   numbers and submission form/email.
2. Decide who signs this — an individual, "AuthiChain," or omit attribution and submit as a
   member of the public. That's a judgment call for a human, not something to default on.
3. Edit the framing above to fit whatever the actual questions ask; don't paste it in wholesale
   if it doesn't match.
