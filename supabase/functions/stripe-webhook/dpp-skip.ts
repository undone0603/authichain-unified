// Advisor ruling 2026-10-24: only https://authichain.com/api/stripe/webhook
// unlocks the DPP report. This function acks DPP checkout sessions with 200
// and writes nothing. Match: metadata.product_line == "dpp_report" (session,
// line-item price or product) or price id == env DPP_REPORT_PRICE_ID.
type Meta = Record<string, unknown> | null | undefined;
const marks = (m: Meta) => m?.product_line === "dpp_report";

export function isDppReportEvent(
  event: { type?: string; data?: { object?: unknown } } | null | undefined,
  dppPriceId: string | null | undefined
): boolean {
  if (!String(event?.type ?? "").startsWith("checkout.session.")) return false;
  const s = (event?.data?.object ?? {}) as {
    metadata?: Meta;
    line_items?: { data?: Array<{ price?: { id?: string; metadata?: Meta; product?: unknown } | null }> };
  };
  const price = (dppPriceId ?? "").trim();
  if (marks(s.metadata)) return true;
  if (price && s.metadata?.stripe_price_id === price) return true;
  for (const li of s.line_items?.data ?? []) {
    const p = li?.price;
    if (!p) continue;
    if (price && p.id === price) return true;
    if (marks(p.metadata)) return true;
    if (p.product && typeof p.product === "object" && marks((p.product as { metadata?: Meta }).metadata)) return true;
  }
  return false;
}
