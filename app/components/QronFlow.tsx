const NODES = [
  {
    label: "Brands",
    desc: "Pay minting + verification fees in $QRON.",
  },
  {
    label: "Validators",
    desc: "Earn $QRON for verification work.",
  },
  {
    label: "Governance",
    desc: "Stake $QRON to steer protocol upgrades.",
  },
  {
    label: "Ordinals Anchor",
    desc: "Periodic anchoring to Bitcoin via ordinals.",
  },
];

export function QronFlow() {
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs">
      <div className="mb-3 text-[11px] uppercase tracking-wide text-white/50">
        $QRON value flow
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {NODES.map((n, i) => (
          <div
            key={n.label}
            className="relative rounded-xl border border-white/15 bg-black/40 p-3"
          >
            <div className="text-[11px] font-semibold text-white">
              {n.label}
            </div>
            <p className="mt-1 text-[11px] text-white/70">{n.desc}</p>
            {i < NODES.length - 1 && (
              <div className="pointer-events-none absolute right-[-10px] top-1/2 hidden h-px w-6 -translate-y-1/2 bg-gradient-to-r from-white/40 to-transparent md:block" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
