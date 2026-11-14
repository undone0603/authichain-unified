# Consent-first verification sharing (draft integration card)

This is a **copy/paste template**, not a certificate, endorsement, or claim that any buyer has used AuthiChain. Share only a public verification URL for a record you own or have explicit permission to disclose. Never include private serials, personal information, secrets, or internal receipt IDs.

## Suggested plain-text card

> Verify this product record independently: [public verification URL].
> Result: [verified | not_found | unknown | revoked | unverified].
> Checked at: [UTC ISO-8601 timestamp]. Evidence source: [public source URL].
> Issuer: [issuer identifier, only if independently attributable].
> The result describes evidence available at the check time; it does not certify authenticity, ownership, safety, or regulatory compliance.
> Open the verification URL to check the **current** status; do not rely on this copied result as live proof.

Do not replace the bracketed fields with guesses. Do not claim `verified` without an independently checked cryptographic result and valid issuer trust context. If any required evidence is missing, use `unverified` or omit the card.

## Safe adoption flow

1. **Discovery:** A visitor finds an owner-published card or public guide. Views and bot hits are not buyers.
2. **Independent check:** The visitor opens the public verification URL; the viewer can inspect current result, issuer, source and observation time.
3. **Explicit opt-in:** The visitor requests integration information or authorizes a follow-up. A public GitHub issue, scraped lead, or marketplace listing is not consent.
4. **Authorized purchase:** The visitor deliberately approves payment. No agent may sign or pay on their behalf without explicit authority.
5. **Fulfilled external conversion:** Count revenue only with independently authenticated settlement, unique non-house payer, matched entitlement/service delivery, and refund/dispute checks.

## Attribution without surveillance

An optional campaign identifier may be carried in an owned URL or opt-in form, but it is not proof of a buyer. Do not use fingerprinting, cross-site identifiers, or hidden tracking. Report separately: visits, qualified opt-ins, authorized checkouts, settled payments, fulfilled purchases and repeat external customers. Exclude founder tests, free sessions, duplicates, refunds and disputed payments.

## Publication and permission gates

- Publish cards only in AuthiChain-controlled materials or where a partner has affirmatively authorized sharing.
- Do not imply partner endorsements, live integration, external adoption, verified revenue or regulatory certification.
- This document introduces no new endpoint, API contract, signed payload, financial action, or production change.
- Before publishing a real customer example, obtain permission for the specific record and verify that the public URL does not disclose protected fields.

Related: #2487 (ethical shareable evidence), #2485 (x402 marketplace discovery), #2263 (adoption coordination).
