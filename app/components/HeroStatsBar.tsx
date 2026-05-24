"use client";

import { useEffect, useState } from "react";

const format = (n: number) => n.toLocaleString();

export function HeroStatsBar() {
  const [verifications, setVerifications] = useState(12482);
  const [nfts] = useState(8204);
  const [brands] = useState(42);

  useEffect(() => {
    const id = setInterval(() => {
      setVerifications((v) => v + Math.floor(Math.random() * 3));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm md:grid-cols-4">
      <div>
        <div className="text-xl font-semibold">{format(verifications)}</div>
        <div className="text-xs text-white/70">Verifications today</div>
      </div>
      <div>
        <div className="text-xl font-semibold">2.1s</div>
        <div className="text-xs text-white/70">Avg verification time</div>
      </div>
      <div>
        <div className="text-xl font-semibold">{format(nfts)}</div>
        <div className="text-xs text-white/70">NFT certificates</div>
      </div>
      <div>
        <div className="text-xl font-semibold">{brands}</div>
        <div className="text-xs text-white/70">Active brands</div>
      </div>
    </div>
  );
}
