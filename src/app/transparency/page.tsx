import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Transparency | AuthiChain",
  description:
    "Measured AuthiChain figures only. Demo objects are labeled. Unearned certifications are not claimed.",
};

type LedgerCounts = {
  total_users: number;
  total_qrons: number;
  total_scans: number;
  generated_at: string;
};

async function loadPublicCounts(): Promise<LedgerCounts | null> {
  try {
    const base =
      process.env.NEXT_PUBLIC_APP_URL || "https://authichain.com";
    const res = await fetch(`${base}/api/social-proof?fresh=1`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      stats?: {
        total_users?: number;
        total_qrons?: number;
        total_scans?: number;
      };
      generated_at?: string;
    };
    if (
      typeof body.stats?.total_users !== "number" ||
      typeof body.stats?.total_qrons !== "number" ||
      typeof body.stats?.total_scans !== "number"
    ) {
      return null;
    }
    return {
      total_users: body.stats.total_users,
      total_qrons: body.stats.total_qrons,
      total_scans: body.stats.total_scans,
      generated_at: body.generated_at || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function Figure({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="p-6 rounded-xl border border-gray-800 bg-black/40">
      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">
        {label}
      </p>
      <p className="text-3xl font-black tabular-nums">
        {value == null ? "—" : value.toLocaleString("en-US")}
      </p>
    </div>
  );
}

export default async function TransparencyPage() {
  const stats = await loadPublicCounts();
  const measured = stats != null;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-4xl mx-auto px-6 py-24">
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.25em] mb-4">
          Public ledger
        </p>
        <h1 className="text-4xl font-black uppercase tracking-tight leading-none mb-4">
          Transparency
        </h1>
        <p className="text-zinc-400 text-sm max-w-2xl leading-relaxed mb-12">
          These numbers are counted from the live ledger. They are not floors,
          estimates, or marketing minimums. If a figure is not measured, it is
          not shown. Seeded{" "}
          <span className="font-mono text-xs text-zinc-300">DEMO / SAMPLE DATA</span>{" "}
          objects are excluded — they are not customers.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <Figure
            label="Profiles"
            value={stats ? stats.total_users : null}
          />
          <Figure
            label="QRON objects"
            value={stats ? stats.total_qrons : null}
          />
          <Figure
            label="Recorded scans"
            value={stats ? stats.total_scans : null}
          />
        </div>

        {!measured && (
          <div className="p-6 rounded-xl border border-gray-800 bg-black/40 text-sm text-zinc-400 mb-12">
            Ledger counts could not be loaded right now. This page does not
            substitute a placeholder.
          </div>
        )}

        {stats?.generated_at && (
          <p className="text-zinc-600 text-xs mb-12">
            Counted at {stats.generated_at}
          </p>
        )}

        <div className="p-6 border border-gray-800 rounded-xl bg-black/40 space-y-4 text-sm text-zinc-400 leading-relaxed">
          <h2 className="text-white font-semibold">What we do not claim</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>No SOC 2 report is published.</li>
            <li>No NSF SBIR or DHS SVIP award is claimed.</li>
            <li>
              No invented review scores, country totals, or live activity
              counters.
            </li>
            <li>
              Mainnet transaction hashes are listed only with network and date,
              and only for objects that actually exist on that network.
            </li>
          </ul>
          <p>
            Network probes live on{" "}
            <Link href="/status" className="text-[#FFD700] hover:underline">
              /status
            </Link>
            . The DPP readiness offer is on{" "}
            <Link href="/dpp" className="text-[#FFD700] hover:underline">
              /dpp
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
