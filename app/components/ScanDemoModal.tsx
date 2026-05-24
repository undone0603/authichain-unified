"use client";

import { useState } from "react";

export function ScanDemo() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "verifying" | "verified">("idle");

  const start = () => {
    setOpen(true);
    setState("verifying");
    setTimeout(() => setState("verified"), 1800);
  };

  return (
    <>
      <button
        onClick={start}
        className="mt-4 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10"
      >
        Try a scan demo
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                TRUMARK Scan Demo
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-xs text-white/60 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-[120px,1fr] gap-4">
              <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-neutral-900 p-3">
                <div className="h-20 w-20 rounded-lg bg-[radial-gradient(circle_at_30%_20%,#6ee7ff,transparent_55%),radial-gradient(circle_at_70%_80%,#a855f7,transparent_55%)]" />
                <p className="mt-2 text-[10px] text-white/70">
                  Example product QR
                </p>
              </div>
              <div className="space-y-2 text-xs text-white/80">
                <p>Product: Alpine Reserve 2024</p>
                <p>Batch: AR-0424-TRU</p>
                <p>Chain: Polygon PoS</p>
                {state === "verifying" && (
                  <p className="mt-2 text-[11px] text-cyan-300">
                    Verifying cryptographic seal…
                  </p>
                )}
                {state === "verified" && (
                  <p className="mt-2 text-[11px] text-emerald-300">
                    Verified on Polygon in 2.1 seconds. Signature and metadata
                    match.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
