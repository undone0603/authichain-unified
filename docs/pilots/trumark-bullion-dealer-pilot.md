# TruMark bullion/custody evidence pilot — proposal, not a live product offer

**Date:** 2026-11-03 · **Status:** review only, no paid buyer, no partnership, no manufacturer endorsement, no pricing invented.

## Problem and offer
Dealers and buyers receive goods with fragmented photographs, serial notes, purchase records, testing claims and custody documents. TruMark supplies a photo- and hash-backed observation record, privacy-controlled evidence workflow and QR pointer showing what was **actually checked**.

## 14-day opt-in pilot (email-first; no sales calls required)
- **Days 1–2 — Intake:** A dealer volunteers one sample unit and permission to publish limited metadata; original photographs, customer identity, value, price and full serial remain private.
- **Days 3–6 — Testing:** A qualified examiner identifies the item, package condition, method/instrument, test limitations and dated written findings. No particular technique is guaranteed effective through an assay blister.
- **Days 7–10 — Signing:** Only with an authorized issuer and independent review of report scope/authority may AuthiChain issue a signed evidence record. No invented GTIN, serial or manufacturer's signature.
- **Days 11–14 — Independent review:** A separate agent or consumer scans and verifies status, issuer, evidence digest, revocation and uncertainty; test revoked/unknown/not-found cases.

## Proposed deliverables
1. Read-only, public or permissioned TruMark observation page.
2. Local vision diagnostics (glare, image quality, exact-file SHA-256 and same-view similarity); **not an AI authenticity score**.
3. Fail-closed inspection intake gate and independent issuer verification.
4. Source-backed report of evidence provenance, plus scannable QR that does not disclose full serial.
5. Third-party inspection acceptance checklist and independently checkable verification outcomes.

## Acceptance criteria and controls
- Public QR contains no full serial or source photos; photos remain private unless separately authorized.
- The physical-asset binding uncertainty remains visible, even after a document's signature verifies.
- Bad images, changed bytes, unknown issuer, revoked records and unregistered units produce an evidence/status outcome, not automatic counterfeit accusations.
- CI, peer review, and applicable approval gates precede main merge or production changes.
- No dealer logo, customer testimonial, Valcambi endorsement, promise of zero-cost assay, or price unless verified and authorized.

## Buyer-facing opt-in outreach draft (NOT SENT)
**Subject:** One-unit QR evidence pilot for bullion — asynchronous review

We're developing an evidence-led verification workflow for precious-metal dealers. It connects photographs and an independently obtained examination report to a readable QR record, distinguishing genuine signed paperwork from physical-metal authenticity. Participation is optional, and the pilot can be reviewed by email without a sales call. May I send a one-unit written pilot checklist and a live evidence-only example? No manufacturer endorsement is implied.

## Source and live example
- https://authichain-trumark-pt25.undone-k.workers.dev/
- https://github.com/undone0603/authichain-unified/pull/2300
