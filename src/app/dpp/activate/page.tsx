"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ActivateForm() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") || "";
  const visitId = searchParams.get("visit_id") || "";

  const [categories, setCategories] = useState("");
  const [markets, setMarkets] = useState("");
  const [labeling, setLabeling] = useState("");
  const [callWindows, setCallWindows] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const canSubmit = useMemo(
    () =>
      Boolean(
        sessionId && categories.trim() && markets.trim() && labeling.trim()
      ),
    [sessionId, categories, markets, labeling]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || status === "saving") return;
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/dpp/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          visit_id: visitId || undefined,
          categories,
          markets,
          labeling,
          call_windows: callWindows,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.detail || `HTTP ${res.status}`);
      }
      setProfileId(data.profile_id || null);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Activation failed");
    }
  }

  if (!sessionId) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-white">
          Missing checkout session
        </h1>
        <p className="mt-3 text-zinc-400">
          Open this page from your purchase confirmation email or the thank-you
          page.
        </p>
        <a
          href="https://authichain.com/dpp"
          className="mt-8 inline-block text-cyan-300 underline"
        >
          Back to DPP offer
        </a>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
          Merchant activated
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white">
          You&apos;re live
        </h1>
        <p className="mt-4 text-zinc-400">
          Intake saved. Your workspace is provisioned
          {profileId ? ` (profile ${profileId.slice(0, 8)}…)` : ""}. Next:
          publish your first DPP from the dashboard — no operator handoff
          required.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-black"
        >
          Open dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">
        Self-serve activation
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-white">
        Activate your DPP audit
      </h1>
      <p className="mt-3 text-zinc-400">
        Complete this once. Humans are only notified for exceptions — routine
        fulfillment is automatic.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <label className="block text-left text-sm text-zinc-300">
          Product categories / SKU families in scope
          <textarea
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
            rows={3}
            value={categories}
            onChange={e => setCategories(e.target.value)}
            required
          />
        </label>
        <label className="block text-left text-sm text-zinc-300">
          EU markets you sell into (or plan to)
          <textarea
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
            rows={2}
            value={markets}
            onChange={e => setMarkets(e.target.value)}
            required
          />
        </label>
        <label className="block text-left text-sm text-zinc-300">
          Current labeling / QR / NFC setup (or &quot;none&quot;)
          <textarea
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
            rows={2}
            value={labeling}
            onChange={e => setLabeling(e.target.value)}
            required
          />
        </label>
        <label className="block text-left text-sm text-zinc-300">
          Preferred call windows (optional)
          <textarea
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
            rows={2}
            value={callWindows}
            onChange={e => setCallWindows(e.target.value)}
            placeholder="Timezone + 2–3 options"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit || status === "saving"}
          className="w-full rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-black disabled:opacity-50"
        >
          {status === "saving" ? "Activating…" : "Activate merchant"}
        </button>
      </form>
    </div>
  );
}

export default function DppActivatePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <Suspense
        fallback={
          <div className="p-16 text-center text-zinc-400">Loading…</div>
        }
      >
        <ActivateForm />
      </Suspense>
    </main>
  );
}
