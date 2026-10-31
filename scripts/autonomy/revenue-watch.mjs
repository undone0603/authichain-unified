// scripts/autonomy/revenue-watch.mjs
//
// Chargeable-payment webhook-delivery watchdog. A Stripe `paid` session with
// amount_total=0 is not customer revenue. A positive-amount paid session must
// have a successful `stripe_events` receipt; absence needs investigation.
// A successful webhook receipt does NOT prove entitlement or activation.
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
        s.payment_status === "paid" &&
        s.amount_total !== 0
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
  // Stripe returns at most 100 sessions per page; never silently miss later
  // pages. Incomplete reads must fail closed in the ops-pulse monitor.
  const sessions = [];
  let cursor;
  let complete = false;
  for (let page = 0; page < 10; page++) {
    const url = `https://api.stripe.com/v1/checkout/sessions?limit=100&created[gte]=${since}&status=complete` +
      (cursor ? `&starting_after=${encodeURIComponent(cursor)}` : "");
    const sRes = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    if (!sRes.ok) throw new Error(`Stripe checkout sessions -> ${sRes.status}`);
    const body = await sRes.json();
    if (!Array.isArray(body.data))
      throw new Error("Stripe checkout sessions: invalid page");
    // Stripe must supply a boolean has_more; an absent/malformed flag cannot
    // be interpreted as the final page (which would silently hide payments).
    if (typeof body.has_more !== "boolean")
      throw new Error("Stripe checkout sessions: invalid pagination flag");
    sessions.push(...body.data);
    if (!body.has_more) {
      complete = true;
      break;
    }
    cursor = body.data.at(-1)?.id;
    if (!cursor) throw new Error("Stripe checkout sessions: missing page cursor");
  }
  if (!complete)
    throw new Error("Stripe checkout sessions: pagination limit exceeded");
  const paid = sessions.filter(
    s => s.payment_status === "paid" && s.amount_total !== 0
  );
  if (!paid.length) return { checked: 0, problems: [] };
  const events = [];
  // Bound URL length for large windows; any failed page invalidates the check.
  for (let i = 0; i < paid.length; i += 50) {
    const ids = paid.slice(i, i + 50).map(s => `"${s.id}"`).join(",");
    const eRes = await fetchImpl(
      `${supabaseUrl}/rest/v1/stripe_events?select=session_id,event_type,status&session_id=in.(${encodeURIComponent(ids)})`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    if (!eRes.ok) throw new Error(`Supabase stripe_events -> ${eRes.status}`);
    const rows = await eRes.json();
    if (!Array.isArray(rows)) throw new Error("Supabase stripe_events: invalid response");
    events.push(...rows);
  }
  return {
    checked: paid.length,
    problems: findUnfulfilled(paid, events, { founderEmails }),
  };
}
