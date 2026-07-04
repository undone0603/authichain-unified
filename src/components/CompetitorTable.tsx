import { Check, X } from 'lucide-react';

type Cell = boolean | string;

interface Row {
  feature: string;
  cells: [Cell, Cell, Cell, Cell]; // AuthiChain, Scantrust, VeChain, Circularise
}

const COLUMNS = ['AuthiChain', 'Scantrust', 'VeChain', 'Circularise'] as const;

const ROWS: Row[] = [
  { feature: 'Price transparency', cells: [true, false, false, false] },
  { feature: 'Setup time', cells: ['< 1 day', 'Weeks', 'Months', 'Weeks'] },
  { feature: 'Blockchain anchoring', cells: [true, false, true, true] },
  { feature: 'EU DPP ready', cells: [true, false, false, true] },
  { feature: 'Open API', cells: [true, true, false, false] },
  { feature: 'Government contracts', cells: [true, false, false, false] },
  { feature: 'Cannabis compliance', cells: [true, false, false, false] },
];

function CellValue({ value, highlight }: { value: Cell; highlight: boolean }) {
  if (typeof value === 'string') {
    return (
      <span
        className={`text-[11px] font-black uppercase tracking-tight ${
          highlight ? 'text-gold' : 'text-zinc-500'
        }`}
      >
        {value}
      </span>
    );
  }
  return value ? (
    <Check
      className={`mx-auto h-5 w-5 ${highlight ? 'text-gold' : 'text-emerald-500'}`}
      aria-label="Yes"
    />
  ) : (
    <X className="mx-auto h-5 w-5 text-zinc-700" aria-label="No" />
  );
}

/**
 * "Why AuthiChain vs competitors" comparison table for the AuthiChain
 * (default) brand landing page. Dark-themed (bg-zinc-900), mobile responsive
 * via horizontal scroll. Static / server-safe.
 */
export function CompetitorTable() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="mb-12 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-gold">
          Head-to-Head
        </span>
        <h2 className="mt-6 text-3xl font-black uppercase tracking-tighter md:text-4xl">
          Why AuthiChain <span className="gold-text">Beats the Field</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm font-medium uppercase tracking-widest text-zinc-500">
          One platform for blockchain provenance, EU DPP, and government-grade authentication.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
        <table className="w-full min-w-[640px] border-collapse text-center">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="p-5 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Capability
              </th>
              {COLUMNS.map((col, i) => (
                <th
                  key={col}
                  className={`p-5 text-[11px] font-black uppercase tracking-widest ${
                    i === 0
                      ? 'bg-gold/10 text-gold'
                      : 'text-zinc-400'
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr
                key={row.feature}
                className="border-b border-zinc-800/70 last:border-b-0"
              >
                <td className="p-5 text-left text-[12px] font-bold uppercase tracking-tight text-zinc-300">
                  {row.feature}
                </td>
                {row.cells.map((cell, i) => (
                  <td
                    key={i}
                    className={`p-5 ${i === 0 ? 'bg-gold/[0.06]' : ''}`}
                  >
                    <CellValue value={cell} highlight={i === 0} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-center text-[9px] font-bold uppercase tracking-widest text-zinc-700">
        Comparison based on publicly documented capabilities as of 2026. Competitor names are trademarks of their owners.
      </p>
    </section>
  );
}
