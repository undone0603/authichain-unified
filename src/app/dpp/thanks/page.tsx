"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { checkoutActivationHref } from "@/lib/checkout-confirmation";

function ThanksContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") || "";
  const visitId = searchParams.get("visit_id") || "";
  // These are user-supplied URL params, not evidence of a paid checkout.
  const activationHref = checkoutActivationHref(sessionId, visitId);

  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
        Checkout status unverified
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-white">
        We cannot confirm payment here
      </h1>
      <p className="mt-4 text-zinc-400">
        If you completed checkout, allow the payment confirmation to process.
        This page does not verify settlement, grant credits, or open a
        workspace. Activation eligibility is checked by the secure service.
      </p>
      <Link
        href={activationHref || "/dpp"}
        className="mt-8 inline-flex rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-black"
      >
        {activationHref ? "Check activation eligibility" : "Back to DPP offer"}
      </Link>
      <p className="mt-6 text-sm text-zinc-500">
        Use the link from your confirmation email if you have one. If no
        checkout reference is available, return to the offer.
      </p>
    </div>
  );
}

export default function DppThanksPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <Suspense
        fallback={
          <div className="p-16 text-center text-zinc-400">Loading…</div>
        }
      >
        <ThanksContent />
      </Suspense>
    </main>
  );
}
