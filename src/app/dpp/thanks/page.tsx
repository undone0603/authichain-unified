"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function ThanksContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") || "";
  const visitId = searchParams.get("visit_id") || "";

  const activateHref = sessionId
    ? `/dpp/activate?session_id=${encodeURIComponent(sessionId)}${
        visitId ? `&visit_id=${encodeURIComponent(visitId)}` : ""
      }`
    : "/dpp/activate";

  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
        Payment received
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-white">
        DPP audit provisioned
      </h1>
      <p className="mt-4 text-zinc-400">
        Your workspace access is being granted automatically. Activate now to
        complete merchant setup — no need to wait for an email reply.
      </p>
      <Link
        href={activateHref}
        className="mt-8 inline-flex rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-black"
      >
        Activate merchant
      </Link>
      <p className="mt-6 text-sm text-zinc-500">
        A confirmation email with the same link is also on the way.
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
