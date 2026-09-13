import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderNightstamp } from "@/lib/starmap/render";

function localParts(eventAt: string, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(eventAt));
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "00";
  return { dateISO: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: row, error } = await supabaseAdmin.from("qr_arts").select("id,event_at,lat,lon,tz,place_label,dedication,style,sku,catalog_hash").eq("id", id).maybeSingle();
  if (error || !row) return new NextResponse("Not found", { status: 404 });

  const parts = localParts(row.event_at, row.tz);
  const png = await renderNightstamp({
    dateISO: parts.dateISO,
    time: parts.time,
    lat: Number(row.lat),
    lon: Number(row.lon),
    tz: row.tz,
    placeLabel: row.place_label,
    dedication: row.dedication ?? undefined,
    style: row.style ?? "navy-gold",
    sku: row.sku ?? "portal",
  }, {
    id: row.id,
    url: `https://qron.space/sky/${row.id}`,
    eventAt: row.event_at,
    catalogHash: row.catalog_hash,
  }, false);

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      "content-disposition": `inline; filename="nightstamp-${id}.png"`,
    },
  });
}
