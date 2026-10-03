import Link from "next/link";
import { planById, planPaymentLink } from "../../../lib/plans";

/**
 * StrainChain enterprise entry point.
 *
 * This page used to sell an "Enterprise Anchor Partner" plan at a hardcoded
 * $500/month and post to /api/checkout/enterprise, which does not exist; no
 * such SKU is in src/lib/plans.ts. Per the pricing decision in
 * docs/strategy/strainchain-genetics-passport.md (§3), the pitched tiers are
 * $49 per cultivar, $149/month farm plan, and custom. So the page sells the
 * real Farm Plan from plans.ts, offers the anchor partnership as custom
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
  const farm = planById("strainchain_farm");
  const farmCheckout = planPaymentLink("strainchain_farm");

  return (
    <div className="min-h-screen bg-black px-4 py-20 font-sans text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Secure Your Supply Chain
          </h1>
          <p className="mt-4 text-xl text-gray-400">
            StrainChain for cultivation and retail. Start with the Farm Plan
            today; anchor partnerships are scoped with you.
          </p>
        </div>

        {farm && farmCheckout && (
          <div className="mb-8 overflow-hidden rounded-3xl border border-gray-800 bg-gray-900 shadow-2xl">
            <div className="p-8 sm:p-12">
              <div className="mb-8 flex items-center justify-between border-b border-gray-800 pb-8">
                <div>
                  <h2 className="text-2xl font-bold text-white">{farm.name}</h2>
                  <p className="mt-1 text-gray-400">{farm.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-extrabold text-white">
                    ${farm.price}
                  </p>
                  <p className="text-sm text-gray-500">
                    {farm.price_suffix || " one-time"}
                  </p>
                </div>
              </div>

              <ul className="mb-8 space-y-4 text-gray-300">
                {farm.features.map(feature => (
                  <li key={feature} className="flex items-center">
                    <span aria-hidden="true" className="mr-3 text-green-500">
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              <a
                href={farmCheckout}
                className="flex w-full justify-center rounded-xl border border-transparent bg-white px-8 py-4 text-lg font-bold text-black shadow-sm transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
              >
                {farm.cta}
              </a>
              <p className="mt-4 text-center text-xs text-gray-500">
                Checkout is handled by Stripe.
              </p>
            </div>
          </div>
        )}

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
