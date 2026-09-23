import type { Metadata } from "next";
import { listedPlans } from "@/lib/plans";
import { CheckoutModal, TrialButton } from "./pricing-client";
import { Check } from "lucide-react";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import {
  productSchema,
  brandById,
  breadcrumbSchema,
} from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Pricing | QRON Protocol",
  description:
    "Simple, transparent pricing for AI QR art and industrial product passports.",
};

export default function PricingPage() {
  const qron = brandById("qron");
  const productLd = productSchema({
    name: "QRON Protocol — AI QR Art & Product Passports",
    description:
      "Cryptographically-verified AI QR art generation and industrial product passports. Plans from free to enterprise.",
    brand: qron,
    offers: listedPlans("qron")
      .filter(p => p.price > 0)
      .map(p => ({
        name: p.name,
        description: p.description,
        price: p.price,
        priceCurrency: "USD",
        url: "https://qron.space/pricing",
      })),
  });
  const breadcrumbLd = breadcrumbSchema([
    { name: "Home", url: "https://qron.space" },
    { name: "Pricing", url: "https://qron.space/pricing" },
  ]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <JsonLd data={[productLd, breadcrumbLd]} />
      {/* Header */}
      <section className="pt-32 pb-20 px-6 text-center">
        <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase leading-none">
          PROTOCOL <span className="gold-text">ECONOMY</span>
        </h1>
        <p className="max-w-2xl mx-auto text-zinc-500 text-lg font-medium uppercase tracking-widest leading-relaxed">
          Start free. Scale with industrial power. <br />
          Every QRON is cryptographically signed.
        </p>
      </section>

      {/* Pricing Grid */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {listedPlans("qron").map(plan => (
            <div
              key={plan.id}
              className={`protocol-card p-8 flex flex-col relative transition-all duration-500 group hover:translate-y-[-8px] ${
                plan.highlighted
                  ? "border-gold/40 bg-gold/5 shadow-[0_0_50px_rgba(201,162,39,0.1)]"
                  : "border-zinc-900 bg-zinc-950/50"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gold text-black px-6 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-black text-white">
                    ${plan.price}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                    {plan.price_suffix || " one-time"}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter leading-relaxed">
                  {plan.description}
                </p>
              </div>

              <div className="flex-1 space-y-4 mb-10">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex gap-3">
                    <Check
                      className={`w-4 h-4 shrink-0 ${plan.highlighted ? "text-gold" : "text-zinc-700"}`}
                    />
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              {plan.tier === "free" ? (
                <TrialButton />
              ) : (
                <CheckoutModal
                  planId={plan.id}
                  label={plan.name}
                  price={`$${plan.price}`}
                  paymentLink={plan.stripe_payment_link}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Enterprise Support */}
      <section className="bg-zinc-950 border-y border-zinc-900 py-20 px-6 text-center">
        <h2 className="text-2xl font-black mb-8 uppercase tracking-tighter">
          Need Custom <span className="gold-text">Enterprise</span> Scale?
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/digital-product-passport"
            className="btn-outline-gold px-10 py-4 font-black uppercase tracking-widest text-xs border-zinc-800"
          >
            Explore Industrial DPP
          </Link>
          <a
            href="mailto:ops@qron.space"
            className="btn-gold px-10 py-4 font-black uppercase tracking-widest text-xs shadow-gold"
          >
            Contact Sales
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6">
        <p className="text-center text-[10px] font-bold text-zinc-800 uppercase tracking-widest">
          Payments secured by Stripe · AI Engine by Hugging Face · Settlement on
          Polygon & Bitcoin
        </p>
      </footer>
    </div>
  );
}
