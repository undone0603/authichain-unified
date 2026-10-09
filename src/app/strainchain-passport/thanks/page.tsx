import type { Metadata } from "next";
import Link from "next/link";

// ADM-172: StrainChain Passport (Per Cultivar) checkout lands here instead of
// /dpp/thanks. Copy is deliberately limited: payment received, product in
// development, refund offer. No follow-up promise and no claims about what the passport contains.
export const metadata: Metadata = {
  title: "Payment received | StrainChain Passport",
  robots: { index: false, follow: false },
};

export default function StrainchainPassportThanksPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
          Payment received
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          Thank you for your order
        </h1>
        <p className="mt-4 text-zinc-400">
          We received your payment for the StrainChain Passport — Per Cultivar.
          The passport is still in development.
        </p>
        <p className="mt-4 text-zinc-400">
          Want your money back instead? Email{" "}
          <a
            href="mailto:support@authichain.com"
            className="text-cyan-300 underline"
          >
            support@authichain.com
          </a>{" "}
          and we&apos;ll refund you in full.
        </p>
        <p className="mt-6 text-sm text-zinc-500">
          Questions?{" "}
          <Link href="/contact" className="text-cyan-300 underline">
            Contact us
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
