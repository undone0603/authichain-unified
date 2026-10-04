# StrainChain Demo Mapping

This table maps each cannabis **persona** to the persona-flow demo that
exercises its AuthiChain + QRON authentication workflow through the
StrainChain vertical. Use this as the canonical reference when routing
inbound intake requests (see [`intake.md`](./intake.md)) or when writing
investor / regulator / dispensary-facing material that references live
demos.

## Canonical persona → demo path

| Persona    | Demo Path                         |
| ---------- | --------------------------------- |
| Cultivator | /app/strainchain/demos/cultivator |
| Lab        | /app/strainchain/demos/lab        |
| Dispensary | /app/strainchain/demos/dispensary |
| Consumer   | /app/strainchain/demos/consumer   |
| Regulator  | /app/strainchain/demos/regulator  |

## Current implementation status

Every canonical persona has a dedicated demo surface under
`app/strainchain/demos/*`. The StrainChain landing page at
`app/strainchain/page.tsx` is the public entry point; the demos gallery at
`app/strainchain/demos/page.tsx` is the persona router.

| Persona    | Target path                       | Current surface                             | Status |
| ---------- | --------------------------------- | ------------------------------------------- | ------ |
| Cultivator | /app/strainchain/demos/cultivator | `app/strainchain/demos/cultivator/page.tsx` | Live   |
| Lab        | /app/strainchain/demos/lab        | `app/strainchain/demos/lab/page.tsx`        | Live   |
| Dispensary | /app/strainchain/demos/dispensary | `app/strainchain/demos/dispensary/page.tsx` | Live   |
| Consumer   | /app/strainchain/demos/consumer   | `app/strainchain/demos/consumer/page.tsx`   | Live   |
| Regulator  | /app/strainchain/demos/regulator  | `app/strainchain/demos/regulator/page.tsx`  | Live   |

All five persona demos are indexed from `app/strainchain/demos/page.tsx`
and each carries a marketing header block (Problem / Solution / Business
Value) at the top of its source file.

## Related files

- `app/strainchain/page.tsx` — StrainChain landing page
- `app/strainchain/demos/page.tsx` — persona demo gallery (entry point)
- `app/solutions/cannabis/page.tsx` — AuthiChain × StrainChain cannabis solution page
- `outputs/strainchain-demo-manifest.json` — canonical manifest with
  `why`/`value` metadata per persona
- `outputs/strainchain-economy-map.md` — StrainChain subscription tiers,
  QRON staking ladder, MSO targets
- `outputs/storymode-demo-manifest.json` — ships the Zkittlez OG
  StrainChain storymode product entry
- `public/qron/strainchain-zkittlez-qr.svg` — sample strain QRON asset

## How to add a new persona demo

1. Create `app/strainchain/demos/<persona>/page.tsx` following one of the
   existing persona demos (`cultivator`, `lab`, `dispensary`, `consumer`,
   `regulator`) as a template.
2. Prepend the required marketing header block (see
   [`README.md`](./README.md) → _How to write a new persona demo with a
   marketing header_).
3. Add the new row to the **Canonical persona → demo path** table above.
4. Add a matching entry with `why` and `value` fields to
   `outputs/strainchain-demo-manifest.json`.
5. Link the new demo from `app/strainchain/demos/page.tsx` (the demos
   index).
