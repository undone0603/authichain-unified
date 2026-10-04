# QRON.space Demo Mapping

This table maps each target **industry** to the demo surface that exercises
its QRON identity + AuthiChain authentication flow. Use this as the canonical
reference when routing inbound intake requests (see [`intake.md`](./intake.md))
or when writing investor / marketing material that references live demos.

## Canonical industry → demo path

| Industry     | Demo Path               |
| ------------ | ----------------------- |
| Pharma       | /app/demos/pharma       |
| Cannabis     | /app/demos/cannabis     |
| Luxury       | /app/demos/luxury       |
| Collectibles | /app/demos/collectibles |
| Supply Chain | /app/demos/supplychain  |

## Current implementation status

Every canonical industry has a dedicated demo surface under `app/demos/*`.
The unified QRON order demo at `app/demo/page.tsx` remains the conversion
funnel — every industry page CTAs into it.

| Industry     | Target path             | Current surface                   | Status |
| ------------ | ----------------------- | --------------------------------- | ------ |
| Pharma       | /app/demos/pharma       | `app/demos/pharma/page.tsx`       | Live   |
| Cannabis     | /app/demos/cannabis     | `app/demos/cannabis/page.tsx`     | Live   |
| Luxury       | /app/demos/luxury       | `app/demos/luxury/page.tsx`       | Live   |
| Collectibles | /app/demos/collectibles | `app/demos/collectibles/page.tsx` | Live   |
| Supply Chain | /app/demos/supplychain  | `app/demos/supplychain/page.tsx`  | Live   |

All five industry demos are indexed from `app/demos/page.tsx` and each
carries a marketing header block (Problem / Solution / Business Value) at the
top of its source file.

## Related files

- `app/demos/page.tsx` — industry demo gallery (entry point)
- `app/demo/page.tsx` — unified QRON order demo (conversion funnel)
- `outputs/qron-demo-manifest.json` — canonical manifest with `why`/`value`
  metadata per industry, mirroring AuthiChain&rsquo;s
  `outputs/storymode-demo-manifest.json`
- `lib/demo-targets.ts` — brand/celebrity/sport/culture/luxury targets used
  by the unified QRON order demo

## How to add a new demo

1. Create `app/demos/<industry>/page.tsx` following one of the existing
   industry demos (`pharma`, `cannabis`, `luxury`, `collectibles`,
   `supplychain`) as a template.
2. Prepend the required marketing header block (see
   [`README.md`](./README.md) → _How to write a new demo with a marketing
   header_).
3. Add the new row to the **Canonical industry → demo path** table above.
4. Add a matching entry with `why` and `value` fields to
   `outputs/qron-demo-manifest.json`.
5. Link the new demo from `app/demos/page.tsx` (the demos index).
