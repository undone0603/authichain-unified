"use client";

import { useState } from "react";

const PLANS = ["starter", "pro", "business", "enterprise"] as const;
type PlanId = (typeof PLANS)[number];

/**
 * Opens the gated AuthiChain checkout for a catalogue plan.
 * Price ids stay on the server (POST /api/subscribe and src/lib/plans.ts).
 * Signed-in callers can pass a Supabase access token to use /api/subscribe;
 * otherwise the button navigates to /checkout/<plan> on authichain.com.
 */
export default function CheckoutButton({
  plan,
  tierName,
  accessToken,
}: {
  plan: PlanId;
  tierName: string;
  accessToken?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setError(null);
    if (!accessToken) {
      window.location.assign(`/checkout/${plan}`);
      return;
    }
    try {
      setLoading(true);
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ plan }),
      });
      const data = (await response.json()) as {
        checkout_url?: string;
        error?: string;
      };
      if (!response.ok || !data.checkout_url) {
        setError(data.error || "Checkout did not return a url");
        setLoading(false);
        return;
      }
      window.location.assign(data.checkout_url);
    } catch {
      setError("Network error during checkout");
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCheckout}
      disabled={loading}
      className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-medium text-white shadow-lg transition-all hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50"
    >
      {loading ? "Initializing secure checkout..." : `Deploy ${tierName}`}
      {error ? <span className="mt-2 block text-sm text-white/90">{error}</span> : null}
    </button>
  );
}

export { PLANS };
