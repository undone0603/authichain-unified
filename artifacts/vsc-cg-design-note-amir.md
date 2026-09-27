# DO NOT SEND until founder says send

Audience: Amir Hameed Mir, Chair, W3C Verifiable Supply Chain Community Group (amir@sirraya.org).
Thread: Re: VSC CG: adversarial conformance suite as prior art (AuthiChain) — 1a0c9ef807098431.
Promised 23 Sep 2026: testing model, fixture structure, verdict semantics, rationale.
Not a pitch. Not cannabis. Not Farm.

---

## Cover (if founder authorizes send)

Hi Amir,

As promised, here is the short design note on the testing model we already run against AuthiChain records. It is written for the VSC CG tools/conformance discussion, not as a product brief.

Public sources the group can run today:

- Spec: https://authichain.com/protocol
- Suite: `protocol/conformance/` in https://github.com/undone0603/authichain-unified
- Command: `node protocol/conformance/run.mjs --strict -- node protocol/verifier.mjs`

Happy to file this on w3c-cg/vsc as a design note, or take the tools/conformance workstream if that is the better home.

Zachary Kietzman
AuthiChain

---

## Design note: an adversarial conformance model for verifiable supply-chain records

**Status:** draft for VSC CG review  
**Author:** Zachary Kietzman, AuthiChain  
**Date:** 27 September 2026  
**Scope:** how to test a verifier, not how to market one.

### 1. Problem

A supply-chain credential that can only be checked by asking its issuer has moved the trust problem, not solved it. Conformance language that cannot fail is the same failure in committee form.

The VSC CG charter calls for certification guidelines and conformance criteria. Those criteria need a test that a second implementation can fail in public.

### 2. Testing model

Treat the verifier as a command, not a website.

```
<command> <record.json> [anchor.json]
```

Contract:

- Print one JSON object on stdout with a `verdict` field.
- Ignore process exit code. Only stdout is scored.
- No network call is required for signature checks. On-chain confirmation of an anchor is an optional extra and must be reported as such.
- Time-sensitive fixtures use years 2000 and 2099 so a wall clock cannot change the result.

A published claim of conformance is the `--strict --json` output of that runner, pinned to a fixture-manifest version. `conformant: true` with `passed: N` of `N`. Anything else is a demo.

### 3. Fixture structure

Fixtures are JSON records (W3C VC 2.0 + Ed25519 over JCS) plus an optional anchor object. They are regenerated from fixed seeds so a third party can audit the bytes.

The current AuthiChain suite is 28 vectors in four groups:

| Group | Count | What it is for |
|---|---|---|
| Valid paths | 3 | Signed record with and without a mainnet anchor |
| Canonicalisation | 4 | Implementations that sign or hash raw file bytes instead of RFC 8785 JCS |
| Signature failures | 6 | Tamper, wrong key, truncated proof, missing multibase prefix, non-Ed25519 `did:key` |
| Required fields | 6 | Each mandatory field absent |
| Validity window | 2 | Not-yet-valid, expired |
| Anchor failures | 7 | Hash mismatch, testnet without opt-in, malformed or missing tx, non-CAIP-2 chain |

A separate adversarial folder holds deliberately broken *implementations* and scene fixtures (copied QR, cloned serial, revoked issuer, replay). Those are not scored as the 28. They exist so the suite itself can fail.

The canonicalisation four are the important ones. An implementation that does `JSON.stringify` instead of JCS will pass almost every other test and still disagree with a second verifier on a real item.

### 4. Verdict semantics

Exactly three verdicts. No score at this layer.

| Verdict | Meaning |
|---|---|
| `verified` | Signature valid; anchor present, well formed, mainnet, hash matches |
| `valid-unanchored` | Signature valid; no anchor supplied |
| `invalid` | Any required check failed |

Rules that keep the three from collapsing:

- Missing a required field is `invalid`, not a warning.
- No anchor is `valid-unanchored`, not `verified` and not `invalid`.
- A testnet anchor is treated as unanchored unless the caller opted in. Presenting Amoy or Sepolia as production proof is a known failure mode; it is a failing fixture, not a footnote.
- A truncated or non-CAIP-2 chain identifier is `invalid`.
- `--strict` also checks reason strings. Plain mode compares verdicts only. A published claim should cite `--strict`.

A signature proves who asserted a statement. It does not prove the statement is true. Garbage-in remains `verified` if the issuer signed it. Defenses against false issuance live above this layer.

Revocation is not specified in v0.1. A record signed by a later-compromised key stays cryptographically valid. That gap should be named in any CG certification text rather than papered over.

### 5. Rationale

Numeric scores invite averaging a broken signature with a pretty UI. Partial-credit verdicts invite "mostly verified" packaging on a cloned serial. Offline verification is the only way two parties can disagree about a file instead of about a vendor dashboard.

We already shipped the opposite once: a public index that listed well-known brands as verified against a testnet anchor and a 49-character transaction hash. Those two mistakes are now fixtures (`anchor-testnet-rejected`, `anchor-tx-truncated`). The suite is useful because it can fail the author.

Broken-implementation check on the current runner:

- Reference verifier: 28/28 strict.
- Stub that always returns `verified`: 4/28.
- Correct Ed25519 over raw `JSON.stringify`: 20/28 — fails every valid-signature fixture.

### 6. What this is not

It is not a request that the CG adopt AuthiChain as the credential format. The record is a W3C VC. A conforming VC 2.0 verifier with Ed25519 support can check the signature without this document. Sections above only add anchoring rules and a way to fail them in public.

It is not a live on-chain product registry claim. The open verifier and the fixture runner are what can be evaluated today.

### 7. Ask of the group

1. Treat "conformance" as a command plus a pinned fixture manifest, not a logo.
2. Keep verdicts small. If the CG needs a risk score, keep it in a separate layer.
3. Include at least one canonicalisation vector and one testnet-rejected vector in any shared suite.
4. If a fixture here is wrong, that is a better finding than a green dashboard.

I can open this as a design note on w3c-cg/vsc and take comments there.
