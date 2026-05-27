export function CertificatePreview() {
  return (
    <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs md:grid-cols-[1.1fr,1.2fr]">
      <div className="space-y-3">
        <div className="aspect-video overflow-hidden rounded-xl bg-[radial-gradient(circle_at_20%_20%,#6ee7ff,transparent_55%),radial-gradient(circle_at_80%_80%,#a855f7,transparent_55%)]" />
        <div className="grid grid-cols-2 gap-2 text-[11px] text-white/80">
          <div>
            <div className="text-white/50">NFT ID</div>
            <div className="font-mono text-[10px]">
              0x9f2c…7b1e
            </div>
          </div>
          <div>
            <div className="text-white/50">On‑chain hash</div>
            <div className="font-mono text-[10px]">
              0x3a4c…d912
            </div>
          </div>
          <div>
            <div className="text-white/50">Collection</div>
            <div>TRUMARK · Alpine Reserve</div>
          </div>
          <div>
            <div className="text-white/50">Network</div>
            <div>Polygon PoS</div>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="text-[11px] text-white/60">Scan history</div>
        <ol className="space-y-1 text-[11px] text-white/80">
          <li>2026‑05‑24 · Retail scan · Detroit, MI</li>
          <li>2026‑05‑22 · Distributor intake · Lansing, MI</li>
          <li>2026‑05‑20 · Lab certification · Ann Arbor, MI</li>
        </ol>
        <button className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] font-medium hover:bg-white/10">
          View on PolygonScan
        </button>
      </div>
    </div>
  );
}
