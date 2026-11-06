# Made in USA claim file: fulfilment kit

How to deliver one `musa_claim_file` order ($299 per SKU) by hand. Purchases are held for a person (`humanHold: true`), and the customer page promises origin records, supplier attestations, a signed attestation, and a note of any line item that can't be shown to be US-made.

The file is substantiation support. It is not legal advice or a certification, and it never says a product qualifies. Have counsel review these templates before first use.

## Steps

1. **Confirm the order.** Check Stripe for the paid session, then send the intake email.
2. **Collect the bill of materials.** One row per component, ingredient and piece of packaging, using the sheet below.
3. **Request supplier statements,** only from suppliers the customer names. Never contact the customer's customers.
4. **Map every claim.** Record the exact wording and each place it appears, including flags, maps and "proudly American" lines.
5. **Write the findings.** Check the three label-rule tests below and list every open item. Unknown stays open: don't guess.
6. **Sign the attestation** with `scripts/musa/claim-attestation.mjs`, listing the evidence files and open items.
7. **Deliver** the file and tell the customer about any open items. Suggest they take it to counsel.

## What the findings check

From 16 CFR Part 323, for an unqualified claim on a label:

| Test                                                                               | Evidence to hold                                   | Result                           |
| ---------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------- |
| Final assembly or processing is in the US                                          | Site and process record                            | Supported / Open / Not supported |
| All significant processing is in the US                                            | List of each significant step and where it happens | Supported / Open / Not supported |
| All or virtually all parts and materials are US-made, including what suppliers buy | Supplier statements for each line                  | Supported / Open / Not supported |

Don't apply a percentage as if it were the legal test. Qualified claims and advertising follow the FTC's broader guidance, so flag those for counsel.

## Intake email

> **Subject:** Your Made in USA claim file: what we need
>
> Hi [name],
>
> Thanks for your order. To build the file for [SKU], please send:
>
> 1. Your bill of materials: every component, ingredient and piece of packaging (sheet attached)
> 2. For each line, the supplier's origin statement if you have one, or a contact so we can request it
> 3. Where final assembly and each significant processing step happen
> 4. The exact claim you print or plan to print, and everywhere it appears, including flags, maps and similar wording
>
> We'll only contact the suppliers you name, and never your customers. This is substantiation support, not legal advice.
>
> [Your name]

## Bill of materials sheet

| Line | Component or material | Supplier | Supplier contact | Where it's made | Where its inputs come from | Evidence file | Status |
| ---- | --------------------- | -------- | ---------------- | --------------- | -------------------------- | ------------- | ------ |

Status is one of: Supported, Open, Not supported.

## Supplier request

> **Subject:** Origin information for [component] supplied to [customer]
>
> Hello,
>
> [Customer] has asked us to help document the origin of [component], which you supply to them. Could you confirm:
>
> 1. Where this component is manufactured
> 2. Whether any of its materials or sub-components come from outside the US, and which ones
> 3. The share of US content, if you track it
>
> A signed reply from someone authorized to answer is all we need. Please tell us if you don't know any of these. A clear "unknown" is more useful than a guess.
>
> [Your name], on behalf of [customer]

## Supplier statement

> I am authorized to answer for [supplier]. For [component / part number] supplied to [customer]:
>
> - Place of manufacture: \_\_\_\_\_\_
> - Foreign materials or sub-components: None / Listed here: \_\_\_\_\_\_ / Unknown
> - US content share, if tracked: \_\_\_\_\_\_
>
> This is accurate to the best of my knowledge as of [date].
>
> Name, title, signature, date

## Delivery email

> **Subject:** Claim file for [SKU]
>
> Hi [name],
>
> Your claim file for [SKU] is attached. It holds your origin records, supplier statements, our findings and a signed attestation.
>
> **Open items:** [list each one and what would close it, or "None"]
>
> The attestation confirms that we issued this record and that it hasn't changed. It isn't a certification or a finding that the product qualifies, and this isn't legal advice. Whether to keep, change or qualify your claim is your decision, so please share the file with your counsel.
>
> [Your name]

## Signing the attestation

Put the evidence files and an `input.json` in one folder. `evidence` paths are relative to it.

```json
{
  "id": "claim-001",
  "sku": "RB-100",
  "company": "Example Co",
  "claimWording": "Made in USA",
  "evidence": ["bom.csv", "supplier-acme.pdf", "findings.pdf"],
  "openItems": ["Fastener origin not confirmed"]
}
```

```bash
ISSUER_ED25519_PKCS8_B64=... node scripts/musa/claim-attestation.mjs issue input.json --out attestation.json
node scripts/musa/claim-attestation.mjs verify attestation.json --expect-issuer did:key:...
```

The published issuer is `did:key:z6Mkv3GxMirZuvJjw8h7k7vWQBRnxNVUbRepxR2AuUm2ydHZ`, shown in the claim file page's FAQ. A `did:key` only proves itself, so always verify with `--expect-issuer` set to this value.

Never commit the key. It's held outside the repo at `~/.authichain/musa-issuer.pkcs8.b64` on the founder's laptop, and it needs an offline backup. If it's lost or rotated, issue from a new key and update this value and the FAQ.
