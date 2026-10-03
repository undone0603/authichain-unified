import Link from "next/link";

/**
 * StrainChain enterprise entry point.
 *
 * This page used to sell an "Enterprise Anchor Partner" plan at a hardcoded
 * $500/month and post to /api/checkout/enterprise, which does not exist; no
 * such SKU is in src/lib/plans.ts. Per the pricing decision in
 * docs/strategy/strainchain-genetics-passport.md (§3), the pitched tiers are
 * $49 per cultivar, a farm plan, and custom. The Farm Plan card was removed
 * from this page (PM-222); it offers the anchor partnership as custom
 * (contact), and keeps the features that are not built yet as an explicit
 * roadmap instead of checkmarks.
 */
const ANCHOR_PARTNER_ROADMAP = [
  "Unlimited TruMark tag mints",
  "On-site AI verification",
  "A dedicated Polygon RPC node",
  "METRC bridging",
] as const;

export default function EnterpriseCheckout() {
  return (
    <div className="min-h-screen bg-black px-4 py-20 font-sans text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Secure Your Supply Chain
          </h1>
          <p className="mt-4 text-xl text-gray-400">
            StrainChain for cultivation and retail. Anchor partnerships are
            scoped with you.
          </p>
        </div>


        <div className="overflow-hidden rounded-3xl border border-gray-800 bg-gray-900 p-8 shadow-2xl sm:p-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">
              Enterprise anchor partner
            </h2>
            <p className="text-lg font-semibold text-gray-300">Custom</p>
          </div>
          <p className="mb-6 text-gray-400">
            Multi-site cultivation and retail, scoped and priced with you.
          </p>

          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            On the roadmap (not available yet)
          </h3>
          <ul className="mb-8 space-y-2 text-gray-400">
            {ANCHOR_PARTNER_ROADMAP.map(item => (
              <li key={item} className="flex items-center">
                <span aria-hidden="true" className="mr-3 text-gray-500">
                  ○
                </span>
                {item}
              </li>
            ))}
          </ul>

          <Link
            href="/contact"
            className="flex w-full justify-center rounded-xl border border-gray-600 px-8 py-4 text-lg font-bold text-white transition-colors hover:border-gray-400"
          >
            Talk to us about a partnership
          </Link>
        </div>
      </div>
    </div>
  );
}
