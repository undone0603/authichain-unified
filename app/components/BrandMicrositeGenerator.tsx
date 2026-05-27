"use client";

import { useState } from "react";

export function BrandMicrositeGenerator() {
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState("");
  const [url, setUrl] = useState("");

  const previewSlug =
    brand.trim() === ""
      ? "your-brand"
      : brand.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <>
      <div className="mt-8 flex flex-col items-start gap-3 border-t border-white/10 pt-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-white/50">
            Brand microsites
          </div>
          <div className="text-sm text-white/80">
            Spin up a provenance microsite for each brand in your portfolio.
          </div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium hover:bg-white/10"
        >
          Generate a brand microsite preview
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-neutral-950 p-6 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Brand microsite preview
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-[11px] text-white/60 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <label className="block text-[11px] text-white/70">
                  Brand name
                  <input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-1 text-xs"
                    placeholder="Alpine Reserve"
                  />
                </label>
                <label className="block text-[11px] text-white/70">
                  Primary URL (optional)
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-1 text-xs"
                    placeholder="https://example.com"
                  />
                </label>
                <p className="text-[11px] text-white/60">
                  Future: one‑click deploy to Cloudflare / Vercel with AuthiChain
                  provenance blocks pre‑wired.
                </p>
              </div>
              <div className="space-y-2 rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] text-white/80">
                <div className="text-[10px] uppercase tracking-wide text-white/50">
                  Preview
                </div>
                <div className="text-sm font-semibold">
                  {brand || "Your Brand"}
                </div>
                <div className="text-[11px] text-white/60">
                  authichain.com/brands/{previewSlug}
                </div>
                {url && (
                  <div className="text-[11px] text-white/60">
                    Canonical: {url}
                  </div>
                )}
                <ul className="mt-2 space-y-1">
                  <li>• Live TRUMARK certificate gallery</li>
                  <li>• Scan analytics and trust badges</li>
                  <li>• Compliance + DPP‑ready disclosures</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
