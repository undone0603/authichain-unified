import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TruMark seals | AuthiChain",
  description:
    "TruMark is the physical scan seal. Publish a StrainChain genetics passport at $49, or start EU DPP Readiness at $299. Self-serve checkout — no call booking.",
};

const PASSPORT = "/api/checkout/plan/strainchain_passport";
const DPP = "/api/checkout/dpp";

export default function TruMarkPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <section className="px-6 pt-28 pb-16">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600 mb-4">
            01 / TruMark
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-slate-950 mb-5">
            The scan seal. Checkout is the SKU.
          </h1>
          <p className="text-slate-600 text-lg leading-relaxed mb-8 max-w-2xl">
            TruMark is the physical mark a shopper or inspector scans. It is not
            a price. A cannabis brand publishes one genetics passport for $49.
            Origin and EU documentation run on EU DPP Readiness at $299. Larger
            tag programs start from the published catalogue or a written packet.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={PASSPORT}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white"
            >
              Passport checkout — $49
            </Link>
            <Link
              href={DPP}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900"
            >
              DPP checkout — $299
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-20 grid gap-5 md:grid-cols-3">
        {[
          {
            t: "TruMark",
            d: "The seal and scan story already used in the StrainChain demo and enterprise tag-mint copy. Not a separate Stripe SKU.",
          },
          {
            t: "Passport — $49",
            d: "One published genetics passport from existing CoAs. $49 on the published Stripe Payment Link, or enter a work email for recoverable checkout.",
          },
          {
            t: "EU DPP Readiness — $299",
            d: "Written readiness assessment and self-serve activation. $299 on the published Stripe Payment Link, or enter a work email for recoverable checkout.",
          },
        ].map(c => (
          <article
            key={c.t}
            className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm"
          >
            <h2 className="text-base font-semibold text-slate-950 mb-2">
              {c.t}
            </h2>
            <p className="text-sm text-slate-600">{c.d}</p>
          </article>
        ))}
      </section>

      <section className="border-t border-slate-200 bg-slate-50 px-6 py-16">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold text-slate-950 mb-3">
            Publish a passport or start DPP
          </h2>
          <p className="text-sm text-slate-600 mb-6">
            Self-serve Stripe checkout. For an enterprise tag program, email
            hello@authichain.com and ask for the written packet. Async only — no
            scheduled calls.
          </p>
          <a
            href="mailto:hello@authichain.com?subject=TruMark%20written%20packet"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900"
          >
            Request a written packet
          </a>
        </div>
      </section>
    </div>
  );
}
