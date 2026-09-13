import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderNightstamp } from "@/lib/starmap/render";

function localParts(eventAt: string, tz: string) {
  const d = new Date(eventAt);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "00";
  return { dateISO: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export default async function NightstampPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: row, error } = await supabaseAdmin.from("qr_arts").select("*").eq("id", id).maybeSingle();
  if (error || !row) notFound();

  await supabaseAdmin.from("qr_arts").update({ scan_count: Number(row.scan_count ?? 0) + 1 }).eq("id", id);
  const parts = localParts(row.event_at, row.tz);
  const png = await renderNightstamp({ dateISO: parts.dateISO, time: parts.time, lat: Number(row.lat), lon: Number(row.lon), tz: row.tz, placeLabel: row.place_label, dedication: row.dedication ?? undefined, style: row.style ?? "navy-gold", sku: row.sku ?? "portal" }, { id, url: `https://qron.space/sky/${id}`, eventAt: row.event_at, catalogHash: row.catalog_hash }, false);

  return (
    <main className="min-h-screen bg-[#050811] px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm uppercase tracking-[0.35em] text-amber-300">QRON · MEMORY PORTAL</p>
        <h1 className="mt-3 text-4xl font-semibold">{row.place_label}</h1>
        <p className="mt-2 text-slate-400">{new Date(row.event_at).toLocaleString("en-US", { timeZone: row.tz })}</p>
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <img src={`data:image/png;base64,${png.toString("base64")}`} alt={`Nightstamp for ${row.place_label}`} className="w-full rounded-3xl border border-white/10" />
          <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <p className="text-sm uppercase tracking-widest text-slate-500">The night</p>
            <p className="mt-4 text-lg">{row.dedication || "A moment worth keeping under this sky."}</p>
            <div className="mt-8 border-t border-white/10 pt-6 text-sm text-slate-400">Scans: {Number(row.scan_count ?? 0) + 1}</div>
            <p className="mt-3 text-xs text-slate-500">Catalog hash: {String(row.catalog_hash).slice(0, 16)}…</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
