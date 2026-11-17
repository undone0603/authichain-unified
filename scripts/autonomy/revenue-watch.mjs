// scripts/autonomy/revenue-watch.mjs
//
// Read-only payment and entitlement watchdog. Stripe Checkout confirms payment;
// a correlated webhook receipt reconciles processing, and the profile marker
// records an entitlement grant. None proves settlement or usable product access.
//
// Result objects retain session IDs for restricted local matching. ops-pulse
// fingerprints them before writing public issues.

/** Founder entries are exact emails, or "@domain" to cover smoke aliases. */
export function isFounder(email, founders) {
  const e = String(email ?? "").toLowerCase();
  if (!e) return false;
  if (founders.has(e)) return true;
  const at = e.lastIndexOf("@");
  return at >= 0 && founders.has(e.slice(at));
}

const OK_STATUSES = new Set(["success", "processed", "handled"]);
const PAYMENT_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);
const PROBLEMS = new Set(["PAID_NOT_FULFILLED", "RECONCILIATION_REQUIRED"]);

function evidence(paymentReconciliation, entitlement) {
  return {
    payment: "PAYMENT_CONFIRMED",
    paymentReconciliation,
    settlement: "UNVERIFIED",
    entitlement,
    productAccess: "UNVERIFIED",
    fulfillment: "UNVERIFIED",
  };
}

function eligibleSessions(sessions, { now, graceMs, founderEmails }) {
  const founders = new Set(
    founderEmails.map(e => e.trim().toLowerCase()).filter(Boolean)
  );
  return sessions.filter(
    s =>
      s.status === "complete" &&
      s.amount_total !== 0 &&
      now - s.created * 1000 > graceMs &&
      s.metadata?.is_demo !== "true" &&
      s.livemode !== false &&
      !isFounder(s.customer_details?.email ?? s.customer_email, founders)
  );
}

/**
 * Pure classification. A successful webhook receipt is not enough: the
 * session-specific profile grant marker must also be present.
 */
function eligiblePaidSessions(sessions, options) {
  return eligibleSessions(sessions, options).filter(
    session => session.payment_status === "paid"
  );
}

export function classifyPaidCheckout(session, events, receipts, profiles) {
  if (session.livemode !== true) {
    return {
      session: session.id,
      status: "RECONCILIATION_REQUIRED",
      evidence: evidence("UNVERIFIED", "UNVERIFIED"),
      reason: "Stripe livemode is missing or not confirmed",
    };
  }
  if (!Number.isFinite(session.amount_total) || session.amount_total < 0) {
    return {
      session: session.id,
      status: "RECONCILIATION_REQUIRED",
      evidence: evidence("UNVERIFIED", "UNVERIFIED"),
      reason: "Stripe checkout amount is missing or invalid",
    };
  }
  if (
    session.payment_status === "no_payment_required" &&
    session.amount_total > 0
  ) {
    return {
      session: session.id,
      status: "RECONCILIATION_REQUIRED",
      evidence: evidence("UNVERIFIED", "UNVERIFIED"),
      reason: "Positive-amount checkout does not require payment",
    };
  }
  if (session.payment_status !== "paid") {
    return {
      session: session.id,
      status:
        session.payment_status === "unpaid"
          ? "PAYMENT_PENDING"
          : "RECONCILIATION_REQUIRED",
      evidence: {
        ...evidence("UNVERIFIED", "UNVERIFIED"),
        payment:
          session.payment_status === "unpaid"
            ? "PAYMENT_PENDING"
            : "UNVERIFIED",
      },
      reason: "Checkout is not marked paid by Stripe",
    };
  }

  const sessionEvents = events.filter(
    e =>
      e.session_id === session.id &&
      e.livemode === true &&
      PAYMENT_EVENTS.has(String(e.event_type))
  );
  const paymentEvents = sessionEvents.some(
    event => event.event_type === "checkout.session.async_payment_succeeded"
  )
    ? sessionEvents.filter(
        event => event.event_type === "checkout.session.async_payment_succeeded"
      )
    : sessionEvents;
  const sessionReceipts = receipts.filter(r =>
    paymentEvents.some(e => e.event_id === r.event_id)
  );
  const hasGrant = profiles.some(
    profile => profile.last_grant_session_id === session.id
  );

  if (
    sessionReceipts.some(r =>
      [
        "reconciliation_required",
        "processing",
        "received",
        "duplicate",
      ].includes(String(r.status ?? "").toLowerCase())
    )
  ) {
    return {
      session: session.id,
      status: "RECONCILIATION_REQUIRED",
      evidence: evidence(
        "RECONCILIATION_REQUIRED",
        hasGrant ? "ENTITLEMENT_GRANTED" : "UNVERIFIED"
      ),
      reason: "Webhook receipt is held, processing, or duplicate-only",
    };
  }

  const successfulReceipt = sessionReceipts.some(r =>
    OK_STATUSES.has(String(r.status ?? "").toLowerCase())
  );
  if (!successfulReceipt) {
    return {
      session: session.id,
      status: "RECONCILIATION_REQUIRED",
      evidence: evidence(
        "UNVERIFIED",
        hasGrant ? "ENTITLEMENT_GRANTED" : "UNVERIFIED"
      ),
      reason: hasGrant
        ? "Entitlement marker exists but successful webhook evidence is missing"
        : sessionReceipts.length
          ? "Webhook ran but did not succeed"
          : sessionEvents.length
            ? "Stripe event exists but its webhook receipt is missing"
            : "No matching webhook receipt",
    };
  }

  if (!hasGrant) {
    return {
      session: session.id,
      status: "RECONCILIATION_REQUIRED",
      evidence: evidence("PAYMENT_RECONCILED", "UNVERIFIED"),
      reason:
        "Webhook succeeded but no current profile grant marker exists; this marker is not a historical grant ledger",
    };
  }

  return {
    session: session.id,
    status: "ENTITLEMENT_GRANTED",
    evidence: evidence("PAYMENT_RECONCILED", "ENTITLEMENT_GRANTED"),
    reason:
      "Stripe payment, successful webhook receipt, and profile grant marker match; settlement and product access remain unverified",
  };
}

/**
 * Pure compatibility helper for callers that only have session-keyed webhook
 * rows. This detects receipts, not fulfillment; use classifyPaidCheckout when
 * grant evidence is available.
 */
export function findUnfulfilled(
  sessions,
  events,
  { now = Date.now(), graceMs = 15 * 60_000, founderEmails = [] } = {}
) {
  const handled = new Map();
  for (const e of events) {
    if (!e.session_id || !PAYMENT_EVENTS.has(String(e.event_type))) continue;
    const ok = OK_STATUSES.has(String(e.status ?? "").toLowerCase());
    handled.set(e.session_id, handled.get(e.session_id) || ok);
  }
  return eligiblePaidSessions(sessions, { now, graceMs, founderEmails })
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

async function readJson(response, label) {
  if (!response.ok) throw new Error(`${label} -> ${response.status}`);
  return response.json();
}

async function stripePages({ stripeKey, endpoint, query, fetchImpl }) {
  const rows = [];
  let cursor;
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams(query);
    params.set("limit", "100");
    if (cursor) params.set("starting_after", cursor);
    const response = await fetchImpl(
      `https://api.stripe.com/v1/${endpoint}?${params}`,
      { headers: { Authorization: `Bearer ${stripeKey}` } }
    );
    const body = await readJson(response, `Stripe ${endpoint}`);
    if (!Array.isArray(body.data)) {
      throw new Error(`Stripe ${endpoint}: invalid page`);
    }
    if (typeof body.has_more !== "boolean") {
      throw new Error(`Stripe ${endpoint}: invalid pagination flag`);
    }
    rows.push(...body.data);
    if (!body.has_more) return rows;
    cursor = body.data.at(-1)?.id;
    if (!cursor) throw new Error(`Stripe ${endpoint}: missing page cursor`);
  }
  throw new Error(`Stripe ${endpoint}: pagination limit exceeded`);
}

async function supabaseRows({
  supabaseUrl,
  supabaseKey,
  table,
  select,
  column,
  values,
  fetchImpl,
}) {
  const rows = [];
  for (let i = 0; i < values.length; i += 50) {
    const page = values.slice(i, i + 50);
    const params = new URLSearchParams({ select });
    params.set(column, `in.(${page.join(",")})`);
    const response = await fetchImpl(
      `${supabaseUrl}/rest/v1/${table}?${params}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );
    const body = await readJson(response, `Supabase ${table}`);
    if (!Array.isArray(body)) {
      throw new Error(`Supabase ${table}: invalid response`);
    }
    rows.push(...body);
  }
  return rows;
}

export async function checkFulfilment({
  stripeKey,
  supabaseUrl,
  supabaseKey,
  founderEmails = [],
  hours = 72,
  graceMs = 15 * 60_000,
  now = Date.now(),
  fetchImpl = fetch,
}) {
  const since = Math.floor(now / 1000) - hours * 3600;
  const sessions = await stripePages({
    stripeKey,
    endpoint: "checkout/sessions",
    query: { "created[gte]": String(since), status: "complete" },
    fetchImpl,
  });
  const candidates = eligibleSessions(sessions, {
    now,
    graceMs,
    founderEmails,
  });
  if (!candidates.length) {
    return {
      checked: 0,
      entitlementGranted: 0,
      pending: 0,
      orders: [],
      problems: [],
    };
  }

  const paidSessions = candidates.filter(
    session => session.payment_status === "paid"
  );
  if (!paidSessions.length) {
    return {
      checked: 0,
      entitlementGranted: 0,
      pending: candidates.filter(s => s.payment_status === "unpaid").length,
      orders: candidates.map(session =>
        classifyPaidCheckout(session, [], [], [])
      ),
      problems: [],
    };
  }
  const sessionIds = paidSessions.map(s => s.id);
  const events = await stripePages({
    stripeKey,
    endpoint: "events",
    query: {
      "created[gte]": String(since),
      "types[]": "checkout.session.completed",
    },
    fetchImpl,
  });
  const asyncEvents = await stripePages({
    stripeKey,
    endpoint: "events",
    query: {
      "created[gte]": String(since),
      "types[]": "checkout.session.async_payment_succeeded",
    },
    fetchImpl,
  });
  const sessionEvents = [...events, ...asyncEvents]
    .map(event => ({
      event_id: event.id,
      event_type: event.type,
      session_id: event.data?.object?.id,
      livemode: event.livemode,
    }))
    .filter(
      event =>
        sessionIds.includes(event.session_id) &&
        PAYMENT_EVENTS.has(String(event.event_type))
    );
  const eventIds = [...new Set(sessionEvents.map(event => event.event_id))];
  const receipts = eventIds.length
    ? await supabaseRows({
        supabaseUrl,
        supabaseKey,
        table: "stripe_events",
        select: "event_id,event_type,status,session_id",
        column: "event_id",
        values: eventIds,
        fetchImpl,
      })
    : [];
  const profiles = await supabaseRows({
    supabaseUrl,
    supabaseKey,
    table: "profiles",
    select: "last_grant_session_id",
    column: "last_grant_session_id",
    values: sessionIds,
    fetchImpl,
  });

  const orders = candidates.map(session => {
    const classification = classifyPaidCheckout(
      session,
      session.payment_status === "paid" ? sessionEvents : [],
      session.payment_status === "paid" ? receipts : [],
      session.payment_status === "paid" ? profiles : []
    );
    return {
      ...classification,
      paid_at: new Date(session.created * 1000).toISOString(),
      livemode: session.livemode,
    };
  });
  return {
    checked: paidSessions.length,
    entitlementGranted: orders.filter(
      order => order.status === "ENTITLEMENT_GRANTED"
    ).length,
    pending: orders.filter(order => order.status === "PAYMENT_PENDING").length,
    orders,
    problems: orders.filter(order => PROBLEMS.has(order.status)),
  };
}
