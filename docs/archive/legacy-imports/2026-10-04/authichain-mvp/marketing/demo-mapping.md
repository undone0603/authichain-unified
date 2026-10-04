# AuthiChain Demo Mapping

This table maps each target **industry** to the demo folder that implements
its storymode walkthrough. Use this as the canonical reference when routing
inbound intake requests (see [`intake.md`](./intake.md)) or when writing
investor / marketing material that references live demos.

## Canonical industry → demo path

| Industry     | Demo Path               |
| ------------ | ----------------------- |
| Pharma       | /app/demos/pharma       |
| Cannabis     | /app/demos/cannabis     |
| Luxury       | /app/demos/luxury       |
| Collectibles | /app/demos/collectibles |
| Supply Chain | /app/demos/supplychain  |

## Current implementation status

The canonical list above is the target marketing lineup. The table below
reflects which demos currently ship in the `app/demos/*` tree today, so
marketing, sales, and engineering can see the gap at a glance.

| Industry     | Target path             | Current path                      | Status                        |
| ------------ | ----------------------- | --------------------------------- | ----------------------------- |
| Pharma       | /app/demos/pharma       | `app/demos/pharma/page.tsx`       | ✅ Live                       |
| Luxury       | /app/demos/luxury       | `app/demos/luxury-watch/page.tsx` | ✅ Live (as Luxury Watch)     |
| Fashion      | /app/demos/fashion      | `app/demos/fashion/page.tsx`      | ✅ Live (multi-brand fashion) |
| Supply Chain | /app/demos/supplychain  | `app/demos/supply-chain/page.tsx` | ✅ Live                       |
| Cannabis     | /app/demos/cannabis     | _not yet implemented_             | ⏳ Planned                    |
| Collectibles | /app/demos/collectibles | _not yet implemented_             | ⏳ Planned                    |

## Verticals — persona demos

Beyond the industry demos above, AuthiChain also ships **vertical**
products that fuse AuthiChain + QRON into a single cannabis-native, art-
native, or sector-native protocol. Each vertical has its own persona demo
tree. The cannabis vertical is **StrainChain** at
[strainchain.io](https://strainchain.io).

| Vertical    | Persona    | Demo Path                         |
| ----------- | ---------- | --------------------------------- |
| StrainChain | Cultivator | /app/strainchain/demos/cultivator |
| StrainChain | Lab        | /app/strainchain/demos/lab        |
| StrainChain | Dispensary | /app/strainchain/demos/dispensary |
| StrainChain | Consumer   | /app/strainchain/demos/consumer   |
| StrainChain | Regulator  | /app/strainchain/demos/regulator  |

See [`marketing/strainchain/demo-mapping.md`](./strainchain/demo-mapping.md)
for the full StrainChain persona table and
[`outputs/strainchain-demo-manifest.json`](../outputs/strainchain-demo-manifest.json)
for the canonical persona manifest with `why`/`value` metadata.

## How to add a new demo

1. Create `app/demos/<industry>/page.tsx`.
2. Prepend the required marketing header block (see
   [`README.md`](./README.md) → _How to write a new demo with a marketing
   header_).
3. Add the new row to the **Canonical industry → demo path** table above.
4. Add a matching product + `why` + `value` entry in
   `outputs/storymode-demo-manifest.json` if the demo ships a storymode
   product.
5. Link the new demo from `app/demos/page.tsx` (the demos index).
