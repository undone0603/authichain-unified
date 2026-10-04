# Made in USA Compliance Engine Architecture

```text
BOM Payload + Supplier Documents
              │
              ▼
   BOM Cost Calculation Engine
   (US vs Foreign Manufacturing Costs)
              │
              ▼
   Substantial Transformation Engine
   (HTS codes, Processing Steps, Origin)
              │
              ▼
   Claim Decision & Fail-Closed Engine
   (FTC 16 CFR Part 323 / California / Customs)
              │
              ▼
   Cryptographic Passport Generation
   (Document Hash + Manifest Hash + Signature)
              │
              ▼
   Determination API (no passport until a trusted document workflow exists)
```

## Core Modules
- `src/lib/compliance/rules.ts`: Versioned ruleset matrix.
- `src/lib/compliance/cost.ts`: Deterministic manufacturing cost calculations.
- `src/lib/compliance/transformation.ts`: Substantial transformation evaluation.
- `src/lib/compliance/decision.ts`: Fail-closed claim determination logic.
- `src/lib/compliance/passport.ts`: Cryptographic hashing and passport issuance.
- `src/app/api/v1/compliance/evaluate/route.ts`: Determination-only API. It rejects client-supplied documents and does not mint claim passports. Passport issuance stays in `createClaimPassport` for a future trusted-evidence writer.
