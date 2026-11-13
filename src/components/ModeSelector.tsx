// src/components/ModeSelector.tsx
import { PORTAL_MODES, type PortalModeKey } from "../lib/qron-modes";

const LAUNCH_MODES: PortalModeKey[] = [
  "stellar_seal_certificate",
  "batch_product_verification",
  "limited_edition_drop",
  "stellar_seal_luxury_unbox",
  "chain_of_custody_timeline",
];

export function ModeSelector({
  onSelect,
}: {
  onSelect: (modeId: PortalModeKey) => void;
}) {
  return (
    <div className="mode-selector">
      <h2>Choose a Living QR mode</h2>
      <p>Template fills the prompt. Uses one generation credit.</p>
      <div className="grid gap-4 md:grid-cols-3">
        {LAUNCH_MODES.map((id) => {
          const m = PORTAL_MODES[id];
          return (
            <button
              key={id}
              className="card p-4 text-left border rounded hover:border-accent"
              onClick={() => {
                console.log(JSON.stringify({ evt: "mode_select", mode_id: id }));
                onSelect(id);
              }}
            >
              <h3 className="font-semibold">{m.name}</h3>
              <p className="text-sm text-muted mt-1">{m.promptSeed.slice(0, 120)}…</p>
              <span className="mt-2 inline-block text-xs">[Select]</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
