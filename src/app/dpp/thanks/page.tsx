"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function ThanksContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") || "";
  const visitId = searchParams.get("visit_id") || "";
  const hasSession = /^cs_(?:live|test)_[A-Za-z0-9]+$/.test(sessionId);
  const activateHref = hasSession
    ? `/dpp/activate?session_id=${encodeURIComponent(sessionId)}${
        visitId ? `&visit_id=${encodeURIComponent(visitId)}` : ""
      }`
    : "/checkout/dpp_readiness";

  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
        Checkout status
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-white">
        {hasSession ? "Check your workspace activation" : "Payment not verified"}
      </h1>
      <p className="mt-4 text-zinc-400">
        {hasSession
          ? "Returning from checkout does not confirm payment or open a workspace. The activation service checks your Stripe session before granting access."
          : "This page was opened without a valid checkout session. A return URL is not a receipt or proof of payment."}
      </p>
      <Link
        href={activateHref}
        className="mt-8 inline-flex rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-black"
      >
        {hasSession ? "Check paid activation" : "Return to checkout"}
      </Link>
      <p className="mt-6 text-sm text-zinc-500">
        No payment is taken on this page. If a payment is still processing,
        follow up through Stripe&apos;s payment confirmation.
      </p>
    </div>
  );
}

export default function DppThanksPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <Suspense fallback={<div className="p-16 text-center text-zinc-400">Loading…</div>}>
        <ThanksContent />
      </Suspense>
    </main>
  );
}
