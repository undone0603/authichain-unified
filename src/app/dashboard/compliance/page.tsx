import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  CircleHelp,
  CircleMinus,
  Clock,
  ExternalLink,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { requireComplianceAccess } from "../../../lib/compliance-dal";
import {
  buildPortfolio,
  loadPortfolioRows,
  type PortfolioItem,
} from "../../../lib/compliance-portfolio";
import {
  countdownLabel,
  formatMilestoneDate,
  nextDeadline,
} from "../../../lib/dpp-timeline";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compliance dashboard",
  robots: { index: false, follow: false },
};

// Status steps from the validated fixed status palette (serious, warning);
// neutral for "no duty" and "unmapped". Always rendered with an icon and a
// text label, never colour alone.
const OBLIGATION: Record<
  PortfolioItem["obligation"],
  { label: string; Icon: LucideIcon; color: string }
> = {
  law: { label: "Law, fixed date", Icon: Scale, color: "#ec835a" },
  expected: { label: "Expected", Icon: Clock, color: "#fab219" },
  none: { label: "No DPP duty listed", Icon: CircleMinus, color: "#a1a1aa" },
  unmapped: {
    label: "Category not mapped",
    Icon: CircleHelp,
    color: "#a1a1aa",
  },
};

function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

function ObligationBadge({
  obligation,
}: {
  obligation: PortfolioItem["obligation"];
}) {
  const { label, Icon, color } = OBLIGATION[obligation];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium text-zinc-200"
      style={{ borderColor: `${color}66` }}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" style={{ color }} />
      {label}
    </span>
  );
}

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className="text-2xl font-black text-zinc-100">{value}</p>
      {note ? <p className="mt-1 text-xs text-zinc-400">{note}</p> : null}
    </div>
  );
}

export default async function ComplianceDashboard() {
  const access = await requireComplianceAccess();
  const now = new Date();
  const portfolio = buildPortfolio(
    await loadPortfolioRows(getSupabaseAdmin(), access),
    now
  );
  const { items, counts, nearestLegal } = portfolio;
  const milestone = nextDeadline(now);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-100">
          Compliance dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {access.reason === "owner"
            ? "Owner view: every published Digital Product Passport."
            : "Your published Digital Product Passports and what EU law says about each category."}
        </p>
      </header>

      <section
        aria-label="Summary"
        className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4"
      >
        <Tile label="Published passports" value={String(items.length)} />
        <Tile
          label="Under law with a date"
          value={String(counts.law)}
          note={`${counts.expected} expected · ${counts.none + counts.unmapped} other`}
        />
        <Tile
          label="Nearest legal date"
          value={nearestLegal ? nearestLegal.date : "None"}
          note={
            nearestLegal
              ? `${nearestLegal.days} days · ${nearestLegal.products} passport${nearestLegal.products === 1 ? "" : "s"}`
              : "No passport is in a category with a fixed legal date"
          }
        />
        <Tile
          label="Next EU milestone"
          value={milestone ? formatMilestoneDate(milestone) : "None on this timeline"}
          note={
            milestone
              ? `${milestone.label} · ${countdownLabel(milestone, now)}`
              : undefined
          }
        />
      </section>

      {items.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-zinc-200">
            No published passports on this account yet.
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            Passports you publish appear here with their category&apos;s legal
            status.
          </p>
          <Link
            href="/dpp"
            className="mt-4 inline-block rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
          >
            Open the DPP app
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">
              Published Digital Product Passports
            </caption>
            <thead className="bg-zinc-900 text-[10px] uppercase tracking-widest text-zinc-500">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Product
                </th>
                <th scope="col" className="px-4 py-3">
                  Category
                </th>
                <th scope="col" className="px-4 py-3">
                  EU obligation
                </th>
                <th scope="col" className="px-4 py-3">
                  Legal date
                </th>
                <th scope="col" className="px-4 py-3">
                  Published
                </th>
                <th scope="col" className="px-4 py-3">
                  Record
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {items.map(item => (
                <tr key={item.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-100">{item.name}</p>
                    <p className="text-xs text-zinc-400">
                      {[item.brand, item.serial].filter(Boolean).join(" · ") ||
                        "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {item.categoryLabel ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ObligationBadge obligation={item.obligation} />
                    {item.when ? (
                      <p className="mt-1 max-w-xs text-xs text-zinc-400">
                        {item.when}
                      </p>
                    ) : null}
                    {item.source ? (
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {item.source}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {item.legalDate ? (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock
                          aria-hidden
                          className="h-3.5 w-3.5 text-zinc-400"
                        />
                        {item.legalDate}
                        <span className="text-xs text-zinc-400">
                          ({item.daysToLegalDate} days)
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {day(item.publishedAt)}
                  </td>
                  <td className="px-4 py-3">
                    {item.verifyUrl ? (
                      <a
                        href={item.verifyUrl}
                        className="inline-flex items-center gap-1 text-zinc-200 underline underline-offset-2 hover:text-white"
                      >
                        Verify{" "}
                        <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-xs text-zinc-500">
        Category obligations: only the battery passport has a fixed legal date
        (Regulation (EU) 2023/1542, Art. 77). Other categories are expected
        under the ESPR Working Plan and become law only when a delegated act is
        adopted. Dates and counts are computed when this page loads. Not legal
        advice.
      </p>
    </div>
  );
}
