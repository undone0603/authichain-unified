// scripts/autonomy/revenue-watch.mjs
//
// Fulfilment watchdog. Every Checkout Session that Stripe says is paid must
// have been handled by our webhook: a `stripe_events` row for that session
// with a successful status. A paid session with no such row means a
// customer paid and may not have received what they bought — that is the
// one failure that must reach the owner fast.
//
// Read-only: Stripe GET + Supabase REST GET. Output carries session IDs only
// (no emails, no amounts) because the alert issue lives in a public repo.

/** Founder entries are exact emails, or "@domain" to cover every smoke alias on a domain. */
export function isFounder(email, founders) {
  const e = String(email ?? "").toLowerCase();
  if (!e) return false;
  if (founders.has(e)) return true;
  const at = e.lastIndexOf("@");
  return at >= 0 && founders.has(e.slice(at));
}

const OK_STATUSES = new Set(["success", "processed", "handled", "duplicate"]);

/**
 * Pure. sessions: Stripe checkout sessions. events: rows from stripe_events
 * ({session_id, event_type, status}). graceMs: ignore very fresh sessions so
 * normal webhook latency never alerts.
 */
export function findUnfulfilled(
  sessions,
  events,
  { now = Date.now(), graceMs = 15 * 60_000, founderEmails = [] } = {}
) {
  const founders = new Set(
    founderEmails.map(e => e.trim().toLowerCase()).filter(Boolean)
  );
  const handled = new Map();
  for (const e of events) {
    if (!e.session_id || !String(e.event_type).startsWith("checkout.session."))
      continue;
    const ok = OK_STATUSES.has(String(e.status ?? "").toLowerCase());
    handled.set(e.session_id, handled.get(e.session_id) || ok);
  }
  return sessions
    .filter(
      s =>
        s.status === "complete" &&
        (s.payment_status === "paid" ||
          s.payment_status === "no_payment_required")
    )
    .filter(s => now - s.created * 1000 > graceMs)
    .filter(s => s.metadata?.is_demo !== "true")
    .filter(
      s => !isFounder(s.customer_details?.email ?? s.customer_email, founders)
    )
    .filter(s => handled.get(s.id) !== true)
    .map(s => ({
      session: s.id,
      reason: handled.has(s.id)
        ? "webhook ran but did not succeed"
        : "no webhook record",
      paid_at: new Date(s.created * 1000).toISOString(),
      livemode: s.livemode,
    }));
}

export async function checkFulfilment({
  stripeKey,
  supabaseUrl,
  supabaseKey,
  founderEmails = [],
  hours = 72,
  fetchImpl = fetch,
}) {
  const since = Math.floor(Date.now() / 1000) - hours * 3600;
  const sRes = await fetchImpl(
    `https://api.stripe.com/v1/checkout/sessions?limit=100&created[gte]=${since}&status=complete`,
    {
      headers: { Authorization: `Bearer ${stripeKey}` },
    }
  );
  if (!sRes.ok) throw new Error(`Stripe checkout sessions -> ${sRes.status}`);
  const sessions = (await sRes.json()).data ?? [];
  const paid = sessions.filter(
    s =>
      s.payment_status === "paid" || s.payment_status === "no_payment_required"
  );
  if (!paid.length) return { checked: 0, problems: [] };
  const ids = paid.map(s => `"${s.id}"`).join(",");
  const eRes = await fetchImpl(
    `${supabaseUrl}/rest/v1/stripe_events?select=session_id,event_type,status&session_id=in.(${encodeURIComponent(ids)})`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  if (!eRes.ok) throw new Error(`Supabase stripe_events -> ${eRes.status}`);
  const events = await eRes.json();
  return {
    checked: paid.length,
    problems: findUnfulfilled(paid, events, { founderEmails }),
  };
}
