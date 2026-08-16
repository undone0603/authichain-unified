# Product Hunt launch — the verification protocol

**Launching:** the open spec + reference verifier in `protocol/`. Not the platform.

Every claim below is verifiable by a reader in under a minute. That is deliberate:
we are launching an authenticity product, and the fastest way to lose this
audience is a number they can't check. Nothing here cites user counts,
customers, uptime, or certifications, because we don't have them yet and this
launch does not need them.

---

## Tagline (≤60 chars)

> **Open provenance verification you can run yourself**

Alternates, same constraint:

- `Verify product provenance without trusting the verifier` (54)
- `An open spec + offline verifier for product provenance` (53)
- `Provenance verification that doesn't phone home` (46)

## Description (≤260 chars)

> An open specification and a zero-dependency reference verifier for product
> provenance. Check a signed record and its on-chain anchor offline, in one
> command, with no account and no calls to us. Apache-2.0. Built on W3C
> Verifiable Credentials and GS1 Digital Link.

## Topics

`Developer Tools` · `Open Source` · `API` · `Supply Chain` · `Security`

---

## Maker's first comment

This is the most important asset in the launch. Post it immediately.

---

Hi Product Hunt 👋

I build authentication infrastructure — QR-based provenance for physical
products. Today I'm shipping the part that should never have been closed: the
verification protocol itself, under Apache-2.0.

**The problem with every "verified authentic" badge**

Almost all of them resolve to a vendor's server saying "trust me." That doesn't
solve the trust problem, it relocates it. If the only way to check a claim is to
ask the company that made the claim, you haven't verified anything.

So the reference verifier here does not talk to us. No account, no API key, no
network:

```bash
node verifier.mjs record.json anchor.json
{ "verdict": "verified", "reasons": [], "checks": { "signature": true, "anchorHash": true } }
```

Zero dependencies — `node:` builtins only. Checks an Ed25519 signature over a
JCS-canonicalised W3C Verifiable Credential, then checks that the record's hash
matches what was committed on-chain. Three verdicts — `verified`,
`valid-unanchored`, `invalid`. No score, no partial credit. A score is a product
feature; a verdict is what a verifier owes you.

**Why I'm giving this away**

A spec nobody is allowed to implement isn't a standard, and a verifier nobody
can run independently isn't proof. Competitors are welcome to implement it. The
platform behind it stays commercial — that's the actual moat. The wire format
never was.

It's built on existing standards rather than a new vocabulary: W3C Verifiable
Credentials 2.0, GS1 Digital Link for item identity, CAIP-2 for chain IDs, RFC
8785 for canonicalisation. Adoption follows compatibility.

**The uncomfortable part**

Two rules in the spec exist because my own product violated them.

I audited my codebase this week and found a "Global Authenticity Index" listing
Hermès and Pfizer as verified assets. Neither is a customer. All the anchors
pointed at a **testnet**. One transaction hash was 49 hex characters — not a
real hash at all, just another row's hash with four characters glued to the
front. I also found a homepage counter seeded at 1,247 that incremented itself
every four seconds, so visitors watched fabricated verification activity tick
upward in real time.

I deleted all of it. Then I wrote the two rules into the spec so the class of
claim can't come back:

- **A testnet anchor is not proof.** Rejected unless the caller explicitly opts in.
- **A malformed transaction hash is rejected, not displayed.** Render a truncated
  hash and you've published something that looks like proof and links nowhere.

Both have tests. You can read them.

I'd rather launch with real zeros than invented numbers — especially selling
authenticity. If you catch something else wrong, tell me and I'll fix it in
public.

**Where it's honest about its limits**

v0.1.0 draft, not stable. No revocation yet — a record signed by a compromised
key stays cryptographically valid; that's planned for v0.2 via
`credentialStatus`. And a signature proves *who asserted something*, never that
it's true. An issuer can sign a false statement and this layer will correctly
report `verified`. Defending against that lives above the spec, not in it.

Spec, verifier and license are all in the repo. Independent implementations are
the entire point — happy to answer anything.

---

## Landing section (paste-ready)

For a `/protocol` page. Copy only; keep the existing site styling.

> ### Verify it yourself
>
> Most "verified authentic" badges resolve to a vendor's server saying trust me.
> Ours doesn't have to.
>
> The AuthiChain verification protocol is an open specification with a reference
> verifier you can run on your own machine, offline, with no account.
>
> ```bash
> node verifier.mjs record.json anchor.json
> ```
>
> **Apache-2.0.** Anyone may implement it, including competitors. Built on W3C
> Verifiable Credentials, GS1 Digital Link and CAIP-2 — not a private format.
>
> Three verdicts, no partial credit: `verified`, `valid-unanchored`, `invalid`.
> A testnet anchor is not proof. A malformed transaction hash is rejected, not
> displayed.
>
> `[Read the spec]` `[Run the verifier]` `[View the license]`

---

## Do not, under any circumstances

- **Restore the social-proof numbers.** `/api/social-proof` now returns real
  counts. They are zero. Leave them. Being caught with invented user counts on
  launch day, as an authenticity company, in front of the audience most likely
  to check, is not survivable.
- **Add a compliance badge.** No SOC 2, ISO 27001, NIST, DFARS or SBIR claims —
  none are substantiated. They were removed for that reason.
- **Call it a standard.** It is a proposed specification at v0.1.0. Say so.
- **Lead with the pricing page.** The CTA is "read the spec / run the verifier."
  Checkout has never successfully processed a charge; do not make it the
  critical path tonight.

## Pre-launch checklist

- [ ] `protocol/` reachable on the public repo, `LICENSE` visible
- [ ] Copy the verifier command from `protocol/README.md` and run it once, fresh,
      to confirm the quoted output matches exactly
- [ ] `/protocol` landing section live, links resolve
- [ ] Real-card checkout test done and refunded — so the pricing page works for
      anyone who does go looking
- [ ] Someone awake to answer comments in the first two hours
