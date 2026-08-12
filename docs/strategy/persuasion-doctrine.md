# Persuasion Doctrine

How AuthiChain content persuades at maximum strength without asserting anything
it cannot back, and without framing itself as a company recovering from
something.

This governs every autonomous Routine that writes outbound copy. The machine
guardrail (`scripts/validate-social-bundle.mjs`) decides what is *permitted*.
This decides what is *good*. Passing the validator is the floor, not the goal.

---

## The core premise

We have no traffic, no case studies and no third-party audits. The instinct is
to compensate with adjectives, borrowed statistics, or humility. All three lose.

What we have instead is unusual and genuinely more persuasive: **a claim the
reader can check without asking us.** The specification is public, the verifier
runs offline with no account, and the conformance suite can be pointed at any
implementation including ours.

That converts the whole pitch from *trust us* to *check us*. A reader who can
verify does not need to be convinced, and an invitation to verify is the most
credible thing an unknown company can say.

---

## Rule 1 — Lead from strength, never from confession

**This is the rule most easily got wrong, and the reason this document exists.**

Engineering candour is a real asset internally. Pointed outward at strangers it
misfires: a reader who has never heard of you does not experience "here is what
we fixed about ourselves" as integrity. They experience it as a warning. Worse,
it *implies prior dishonesty that the reader had no reason to suspect* — you
introduce a doubt, then ask to be credited for resolving it.

Never open on a defect, an apology, a past mistake, or a correction. Never write
"we used to…", "we were wrong about…", "we removed…", or "unlike our old…".

The honest version of the same material is simply the present tense:

| Confessional (never ship) | Strong and equally true |
|---|---|
| "We shipped a status page that couldn't report an outage. Here's the fix." | "Our status page reports live probe results, and shows unknown when it doesn't know." |
| "We removed the fake statistics from our marketing." | "Every number we publish is one you can reproduce." |
| "We used to claim certifications we didn't hold." | "We claim Ed25519 under FIPS 186-5, because that's what the code does." |

Both columns are true. The right column persuades. The left column volunteers a
liability, and nobody asked.

**A caveat that matters:** none of this licenses hiding a limitation a reader
needs. Rule 5 requires stating real limits plainly. The distinction is between
*disclosing a current limitation* (required, and persuasive) and *narrating your
own reform* (never). "No revocation until v0.2" is the first. "We finally fixed
our misleading claims" is the second.

---

## Rule 2 — Specificity is the persuasion

Vague superlatives read as filler because anyone can write them at zero cost. A
precise number that is *checkable* costs something to state, which is exactly
why it lands.

- Not "rigorously tested" → **"28 adversarial fixtures, and the suite is
  validated against deliberately broken implementations so it demonstrably can
  fail."**
- Not "enterprise-grade cryptography" → **"Ed25519, FIPS 186-5, RFC 8032."**
- Not "government-ready" → **"CAGE 1PUJ6."**
- Not "open source" → **"Apache-2.0, patent grant included — specifically so an
  enterprise legal team can sign off on implementing it."**

Note what these have in common: each is a fact an adversary could disprove.
Statistics about *our performance* are forbidden because we have not measured
them. Facts about *what the system is* are unlimited, and they are better copy.

---

## Rule 3 — Prefer the costly signal

A claim persuades in proportion to what it would cost us if it were false.

- **Publishing the spec under Apache-2.0** lets competitors implement it. Nobody
  does that with a wire format they think is their moat. The act argues for
  itself.
- **Offline verification with no account** means we cannot revoke, meter or
  observe your verification. We gave up the lever.
- **A conformance suite that can fail** — including two fixtures that exist
  because of real failure modes in this product category — invites the exact
  test that would embarrass us.

Lead with the thing that would be expensive to fake. Never explain the signal's
cleverness; state the fact and let the reader draw it.

---

## Rule 4 — Address the skeptic directly

The highest-converting line available to an unknown vendor is a genuine
invitation to disprove them:

> Assume we are overstating this. The spec, the verifier and the suite are
> public — run it against our own output and see what it says.

This is maximally persuasive *and* maximally honest, which is why it is the
house move. It only works if it is literally true, so never write it about
anything not actually runnable.

---

## Rule 5 — State the limits, in the right place

Counter-intuitively, naming a real limitation raises credibility on everything
else — an author who volunteers the hard part is read as level, and the reader
stops hunting for what you're hiding.

Ours, stated plainly whenever technically relevant:

- **No revocation yet.** A record signed by a compromised key stays
  cryptographically valid. Planned for v0.2 via `credentialStatus`.
- **Signatures prove authorship, not truth.** An issuer can sign a false
  statement and a conforming verifier will correctly report `verified`.
  Defending against that lives above this specification.
- **Ed25519 is not post-quantum secure.** Like all elliptic-curve signatures it
  falls to Shor's algorithm.

Placement matters: a limit belongs *after* the substance, never in the opening
line, and never as self-criticism. It is a specification detail, delivered flat.

---

## Rule 6 — Name the distinction

Categories are led by whoever supplies the vocabulary. Where we have a real
conceptual difference, name it and make it the frame:

- **A verdict, not a score.** Three outcomes — `verified`,
  `valid-unanchored`, `invalid` — and no partial credit. A score is a product
  feature; a verdict is what a verifier owes you.
- **Verification you don't have to request.** If you must ask the vendor to
  verify on your behalf, it is attestation, not verification.
- **A testnet anchor is not proof.** Rejected unless the caller explicitly opts
  in.

Each is a genuine distinction and a memorable line. That is the whole trick:
find the place where the truth is already the sharpest available framing.

---

## Rule 7 — Stakes belong to the reader, not to us

Urgency drawn from the reader's real situation is legitimate. Urgency
manufactured from our funnel is not.

- Legitimate: EU DPP obligations arriving on a published schedule; DSCSA;
  counterfeit exposure in their category.
- Never: fake scarcity, invented deadlines, "limited spots", or pressure that
  exists only because we want the deal.

Genuine commercial offers are fine and should be concrete — a pilot price, a
turnaround, a free tier. An offer is a commitment we control and can honour. It
is not a claim about outcomes we have not measured.

---

## Rule 8 — Every link must land where the sentence promised

Routes are **per domain**, and this catches people out. Only `authichain.com`
has real routes. The brand workers handle assets, `sitemap.xml` and
`robots.txt`, then fall through to the homepage — so a deep link like
`qron.space/protocol` does not 404, it silently serves the generic homepage.
That is worse than a broken link: the reader clicks a specific promise and
cannot tell they were sent somewhere else.

| Domain | Linkable routes |
|---|---|
| `authichain.com` | `/` `/protocol` `/spec` `/anchor` `/digital-product-passport` `/dpp` `/pricing` `/book` `/eu-dpp` `/enterprise` `/verify` |
| `qron.space` | `/` only |
| `govchain.us` | `/` only |
| `strainchain.io` | `/` only |

`authichain.com/roi-calculator` does not exist. Neither do `/about` or
`/contact` — they appear in the sitemap but have no handler.

`scripts/validate-social-bundle.mjs` enforces this table per host and is the
source of truth; if a route is added to a worker, update the validator first.

---

## Rule 9 — Write for one engineer who will check

The reader who matters is technical, skeptical, and will click the link. Write
for that person and the marketing audience follows; write for the marketing
audience and the engineer bounces and says so publicly.

Practically: concrete nouns, active voice, no hype adjectives, no emoji stacks,
no "revolutionary" or "game-changing". One idea per post. Every link resolves to
a page that contains what the sentence promised.

---

## Quick reference

**Reach for:** the checkable fact · the runnable command · the costly signal ·
the named distinction · the invitation to disprove · the plainly stated limit ·
the reader's real deadline.

**Never reach for:** our own past mistakes · unmeasured performance ·
certifications not held · absolutes · borrowed industry statistics · manufactured
urgency · a link to a route that does not exist.

**The test before shipping any line:** *Could a hostile expert check this in ten
minutes, and would they come away agreeing?* If yes, it is both honest and as
persuasive as it can be — those turn out to be the same sentence.
