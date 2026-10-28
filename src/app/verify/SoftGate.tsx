"use client";
import { useEffect } from "react";

export function SoftGate({ productId }: { productId?: string }) {
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).plausible) {
      (window as any).plausible("softgate_viewed", { props: { from: "verify" } });
    }
  }, []);

  return (
    <div className="mt-6 rounded-lg border border-steel/20 bg-ivory/5 p-4">
      <p className="text-sm text-ink/80">
        Want unlimited checks + brand dashboard? Create a free account.
      </p>
      <form action="/onboard" method="get" className="mt-3 flex gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="you@brand.com"
          className="flex-1 rounded border px-3 py-2 text-sm"
          aria-label="Email for free account"
        />
        <input type="hidden" name="from" value="verify" />
        {productId && <input type="hidden" name="product" value={productId} />}
        <button type="submit" className="rounded bg-navy px-4 py-2 text-sm text-ivory">
          Create free account
        </button>
      </form>
      <p className="mt-2 text-xs text-steel">
        We only use this email to create your account and send the verification link. No newsletter.
      </p>
      <p className="mt-1 text-xs text-steel">
        First checks stay free. Paid plans start at $79/mo (300 verifs included, $0.05 overage).
      </p>
    </div>
  );
}
