"use client";

import { Suspense } from "react";

function ThanksContent() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
        Payment received
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-white">
        Payment received
      </h1>
      <p className="mt-4 text-zinc-400">
        Thanks. This confirms your $299 payment. Next, use the link in your
        confirmation email to fill in the short onboarding form. The readiness
        work itself is in development.
      </p>
      <p className="mt-6 text-sm text-zinc-500">
        If you&apos;d rather not wait, email support@authichain.com and
        we&apos;ll refund the full $299.
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
