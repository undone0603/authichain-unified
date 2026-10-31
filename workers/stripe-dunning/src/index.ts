/** Invoice collection only. No email, entitlement, or checkout side effects. */
export const BACKOFF_SECONDS = [60, 300, 900, 3600, 21600] as const;
const LEASE_MS = 120_000;
const REDISPATCH_MS = 300_000;
// Stop before Stripe can prune an uncertain request's idempotency key (24h).
const UNCERTAIN_LIMIT_MS = 23 * 60 * 60 * 1000;
const API_VERSION = "2026-08-26.dahlia";

type Mode = "test" | "live";
type Status = "pending" | "retrying" | "paid" | "failed_final" | "stopped" | "needs_action" | "review";
type Result<T = Record<string, unknown>> = { success: boolean; results: T[]; meta: { changes: number } };
interface Statement {
  bind(...values: (string | number | null)[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<Result<T>>;
  run(): Promise<Result>;
}
interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<Result[]>;
}
interface RetryMessage { version: 1; invoice_id: string; mode: Mode; attempt: number }
interface QueueMessage { body: unknown; attempts: number; ack(): void; retry(options: { delaySeconds: number }): void }
export interface Env {
  DB: Database;
  DUNNING_QUEUE: { send(body: RetryMessage, options: { delaySeconds: number }): Promise<unknown> };
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_MODE?: Mode;
  DUNNING_ENABLED?: string;
  DUNNING_LIVE_ENABLED?: string;
}
interface State {
  invoice_id: string; mode: Mode; status: Status; attempt: number;
  next_retry_at: number | null; active_started_at: number | null;
  lease_token: string | null; lease_until: number | null;
}
interface PaymentIntent {
  id?: string; status?: string; last_payment_error?: { type?: string; code?: string; decline_code?: string } | null;
}
interface Invoice {
  id: string; object: string; livemode: boolean; status: string;
  collection_method?: string; auto_advance?: boolean; next_payment_attempt?: number | null;
  metadata?: Record<string, string>; customer?: string | { id: string } | null;
  payment_intent?: string | PaymentIntent | null;
  payments?: { has_more?: boolean; data: { payment?: { type?: string; payment_intent?: string | PaymentIntent | null } }[] };
}
interface Event {
  id: string; type: string; livemode: boolean; created: number; account?: string;
  data: { object: Invoice };
}
type Dependencies = { now?: () => number; fetch?: typeof fetch; uuid?: () => string; log?: (record: Record<string, unknown>) => void };
const SOFT_DECLINES = new Set(["insufficient_funds", "generic_decline", "do_not_honor", "issuer_not_available", "processing_error", "try_again_later"]);
const ACTIVE: Status[] = ["pending", "retrying"];
const EVENTS = new Set(["invoice.payment_failed", "invoice.paid", "invoice.voided", "invoice.marked_uncollectible", "invoice.payment_action_required"]);
const validInvoiceId = (id: unknown): id is string => typeof id === "string" && /^in_[A-Za-z0-9_]+$/.test(id) && id.length <= 255;
const terminal = (status: Status) => !ACTIVE.includes(status);

function enabled(env: Env): boolean {
  return env.DUNNING_ENABLED === "true" && (env.STRIPE_MODE === "test" || (env.STRIPE_MODE === "live" && env.DUNNING_LIVE_ENABLED === "true"));
}
function keyMatchesMode(env: Env): boolean {
  const mode = env.STRIPE_MODE;
  return !!mode && !!env.STRIPE_SECRET_KEY && new RegExp(`^(sk|rk)_${mode}_`).test(env.STRIPE_SECRET_KEY);
}
function assertResults(results: Result[]): void {
  if (results.some(result => !result.success)) throw new Error("D1 write failed");
}

/** Raw-body HMAC verification using asynchronous Workers Web Crypto. */
export async function verifyEvent(body: string, signature: string, secret: string, now: number): Promise<Event> {
  const parts = signature.split(",").map(part => part.trim());
  const timestamps = parts.filter(part => part.startsWith("t="));
  if (timestamps.length !== 1 || !/^t=\d+$/.test(timestamps[0])) throw new Error("Invalid signature");
  const timestamp = Number(timestamps[0].slice(2));
  if (!Number.isSafeInteger(timestamp) || Math.abs(now / 1000 - timestamp) > 300) throw new Error("Expired signature");
  const candidates = parts.filter(part => /^v1=[a-fA-F0-9]{64}$/.test(part)).map(part => part.slice(3));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const signed = new TextEncoder().encode(`${timestamp}.${body}`);
  let verified = false;
  for (const candidate of candidates) {
    const bytes = Uint8Array.from(candidate.match(/../g)!, hex => Number.parseInt(hex, 16));
    if (await crypto.subtle.verify("HMAC", key, bytes, signed)) verified = true;
  }
  if (!verified) throw new Error("Invalid signature");
  return JSON.parse(body) as Event;
}

async function rawBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let body = "";
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > 262_144) { await reader.cancel(); throw new Error("Body too large"); }
      body += decoder.decode(item.value, { stream: true });
    }
    return body + decoder.decode();
  } finally { reader.releaseLock(); }
}

export function createWorker(deps: Dependencies = {}) {
  const now = deps.now ?? Date.now;
  const request = deps.fetch ?? globalThis.fetch;
  const uuid = deps.uuid ?? (() => crypto.randomUUID());
  const log = deps.log ?? (record => console.log(JSON.stringify(record)));

  async function stripe(env: Env, path: string, idempotencyKey?: string): Promise<{ status: number; data: Record<string, unknown> }> {
    if (!keyMatchesMode(env)) throw new Error("Stripe mode/key mismatch");
    const response = await request(`https://api.stripe.com/v1/${path}`, {
      method: idempotencyKey ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Stripe-Version": API_VERSION,
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey, "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      ...(idempotencyKey ? { body: "off_session=true" } : {}),
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
    });
    return { status: response.status, data: await response.json() as Record<string, unknown> };
  }

  async function state(env: Env, id: string): Promise<State | null> {
    return env.DB.prepare("SELECT * FROM stripe_dunning_state WHERE invoice_id = ? AND mode = ?").bind(id, env.STRIPE_MODE ?? "").first<State>();
  }

  // The state row is also the durable outbox. An enqueue claim expires even
  // if the process dies before send(), or the queue ultimately dead-letters it.
  async function dispatch(env: Env, id: string): Promise<void> {
    if (!enabled(env)) return;
    const time = now();
    const token = uuid();
    const row = await env.DB.prepare(`UPDATE stripe_dunning_state
      SET dispatch_token = ?, dispatch_after = MAX(next_retry_at, ?) + ?, updated_at = ?
      WHERE invoice_id = ? AND mode = ? AND status IN ('pending','retrying')
        AND attempt < 5 AND dispatch_after <= ? AND (lease_until IS NULL OR lease_until <= ?)
      RETURNING *`).bind(token, time, REDISPATCH_MS, time, id, env.STRIPE_MODE ?? "", time, time).first<State>();
    if (!row) return;
    try {
      await env.DUNNING_QUEUE.send({ version: 1, invoice_id: id, mode: row.mode, attempt: row.attempt + 1 }, {
        delaySeconds: Math.max(0, Math.ceil(((row.next_retry_at ?? time) - time) / 1000)),
      });
      log({ event: "dunning_queued", invoice: id, mode: row.mode, attempt: row.attempt + 1 });
    } catch {
      assertResults([await env.DB.prepare(`UPDATE stripe_dunning_state SET dispatch_after = ?, updated_at = ?
        WHERE invoice_id = ? AND mode = ? AND dispatch_token = ?`).bind(time + 60_000, time, id, row.mode, token).run()]);
      log({ event: "dunning_enqueue_deferred", invoice: id, mode: row.mode });
    }
  }

  async function intake(env: Env, event: Event): Promise<void> {
    const invoice = event.data.object;
    const time = now();
    const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
    const target: Status = event.type === "invoice.paid" ? "paid" : event.type === "invoice.payment_action_required" ? "needs_action" : "stopped";
    const insert = event.type === "invoice.payment_failed"
      ? env.DB.prepare(`INSERT INTO stripe_dunning_state
          (invoice_id, mode, customer_id, status, attempt, next_retry_at, dispatch_after, updated_at)
          VALUES (?, ?, ?, 'pending', 0, ?, 0, ?) ON CONFLICT(invoice_id, mode) DO NOTHING`)
          .bind(invoice.id, env.STRIPE_MODE!, customer, time + BACKOFF_SECONDS[0] * 1000, time)
      : env.DB.prepare(`INSERT INTO stripe_dunning_state
          (invoice_id, mode, customer_id, status, attempt, next_retry_at, dispatch_after, updated_at)
          VALUES (?, ?, ?, ?, 0, NULL, 0, ?)
          ON CONFLICT(invoice_id, mode) DO UPDATE SET status = excluded.status,
            next_retry_at = NULL, lease_token = NULL, lease_until = NULL, updated_at = excluded.updated_at
          WHERE stripe_dunning_state.status <> 'paid'`).bind(invoice.id, env.STRIPE_MODE!, customer, target, time);
    // D1 batch is transactional: an event can never be recorded without its
    // state. Duplicates do not reset attempts, deadlines, or terminal states.
    assertResults(await env.DB.batch([
      env.DB.prepare(`INSERT INTO stripe_dunning_events (id, mode, type, invoice_id, received_at)
        VALUES (?, ?, ?, ?, ?) ON CONFLICT(id, mode) DO NOTHING`).bind(event.id, env.STRIPE_MODE!, event.type, invoice.id, time),
      insert,
    ]));
    await dispatch(env, invoice.id);
  }

  async function finish(env: Env, row: State, status: Status, result: string, completed = row.attempt): Promise<void> {
    const time = now();
    const due = terminal(status) ? null : time + BACKOFF_SECONDS[completed] * 1000;
    const write = await env.DB.prepare(`UPDATE stripe_dunning_state SET status = ?, attempt = ?, next_retry_at = ?,
      active_started_at = NULL, transport_failures = 0, lease_token = NULL, lease_until = NULL, dispatch_after = 0,
      last_result = ?, updated_at = ? WHERE invoice_id = ? AND mode = ? AND lease_token = ?`)
      .bind(status, completed, due, result, time, row.invoice_id, row.mode, row.lease_token).run();
    assertResults([write]);
    if (write.meta.changes !== 1) return;
    log({ event: "dunning_result", invoice: row.invoice_id, mode: row.mode, attempt: completed, status, result });
    if (!terminal(status)) await dispatch(env, row.invoice_id);
  }

  async function uncertain(env: Env, row: State): Promise<void> {
    const time = now();
    // Keep active_started_at and attempt unchanged: this is a transport retry
    // of the SAME Stripe operation, never permission for a fresh charge.
    assertResults([await env.DB.prepare(`UPDATE stripe_dunning_state SET
      status = CASE WHEN transport_failures >= 9 THEN 'review' ELSE 'retrying' END,
      transport_failures = transport_failures + 1, next_retry_at = ?,
      lease_token = NULL, lease_until = NULL, dispatch_after = 0, last_result = 'uncertain', updated_at = ?
      WHERE invoice_id = ? AND mode = ? AND lease_token = ?`)
      .bind(time + 60_000, time, row.invoice_id, row.mode, row.lease_token).run()]);
    await dispatch(env, row.invoice_id);
  }

  async function process(env: Env, body: RetryMessage): Promise<void> {
    const time = now();
    const token = uuid();
    const row = await env.DB.prepare(`UPDATE stripe_dunning_state SET lease_token = ?, lease_until = ?, updated_at = ?
      WHERE invoice_id = ? AND mode = ? AND status IN ('pending','retrying') AND attempt = ?
        AND next_retry_at <= ? AND (lease_until IS NULL OR lease_until <= ?) RETURNING *`)
      .bind(token, time + LEASE_MS, time, body.invoice_id, body.mode, body.attempt - 1, time, time).first<State>();
    if (!row) return;
    try {
      if (row.active_started_at !== null && now() - row.active_started_at >= UNCERTAIN_LIMIT_MS) {
        await finish(env, row, "review", "idempotency_window_expiring"); return;
      }
      const current = await stripe(env, `invoices/${body.invoice_id}?expand[]=payments.data.payment.payment_intent`);
      if (current.status !== 200) throw new Error("Invoice read failed");
      const invoice = current.data as unknown as Invoice;
      if (invoice.id !== row.invoice_id || invoice.object !== "invoice" || invoice.livemode !== (row.mode === "live")) {
        await finish(env, row, "review", "invoice_identity_mismatch"); return;
      }
      if (invoice.status === "paid") { await finish(env, row, "paid", "already_paid"); return; }
      if (invoice.status !== "open") { await finish(env, row, "stopped", "invoice_not_open"); return; }
      if (invoice.collection_method !== "charge_automatically" || invoice.auto_advance !== false || invoice.next_payment_attempt !== null || invoice.metadata?.authichain_dunning_owner !== "worker-v1") {
        await finish(env, row, "stopped", "collection_owned_elsewhere"); return;
      }
      if (invoice.payments?.has_more) { await finish(env, row, "review", "incomplete_payment_history"); return; }
      const intents = invoice.payments?.data.map(payment => payment.payment?.payment_intent).filter(Boolean) ?? (invoice.payment_intent ? [invoice.payment_intent] : []);
      if (intents.length !== 1) { await finish(env, row, "review", "ambiguous_payment_intent"); return; }
      let intent = intents[0] as string | PaymentIntent;
      if (typeof intent === "string") {
        if (!/^pi_[A-Za-z0-9_]+$/.test(intent)) throw new Error("Invalid payment intent");
        const fetched = await stripe(env, `payment_intents/${intent}`);
        if (fetched.status !== 200) throw new Error("Payment intent read failed");
        intent = fetched.data as PaymentIntent;
      }
      if (intent.status === "processing" || intent.status === "succeeded") {
        await finish(env, row, "review", "awaiting_settlement"); return;
      }
      const error = intent.last_payment_error;
      if (intent.status !== "requires_payment_method" || error?.type !== "card_error" || !SOFT_DECLINES.has(error.decline_code ?? error.code ?? "")) {
        await finish(env, row, "needs_action", "payment_method_or_authentication_required"); return;
      }
      // Re-check the lease after network reads; terminal webhooks revoke it.
      const held = await env.DB.prepare(`UPDATE stripe_dunning_state SET active_started_at = COALESCE(active_started_at, ?)
        WHERE invoice_id = ? AND mode = ? AND lease_token = ? AND lease_until > ?
          AND status IN ('pending','retrying') RETURNING *`).bind(now(), row.invoice_id, row.mode, token, now()).first<State>();
      if (!held || !enabled(env)) return;
      const paid = await stripe(env, `invoices/${row.invoice_id}/pay`, `dunning-v1:${row.mode}:${row.invoice_id}:${body.attempt}`);
      if (paid.status === 200) {
        const result = paid.data as unknown as Invoice;
        if (result.id !== row.invoice_id || result.object !== "invoice" || result.livemode !== (row.mode === "live")) {
          await finish(env, row, "review", "payment_result_identity_mismatch", body.attempt); return;
        }
        await finish(env, row, result.status === "paid" ? "paid" : "review", result.status === "paid" ? "payment_succeeded" : "payment_not_settled", body.attempt);
      } else {
        const error = paid.data.error as { type?: string; code?: string; decline_code?: string } | undefined;
        if (paid.status === 402 && error?.type === "card_error") {
          const soft = SOFT_DECLINES.has(error.decline_code ?? error.code ?? "");
          await finish(env, row, !soft ? "needs_action" : body.attempt === BACKOFF_SECONDS.length ? "failed_final" : "retrying", soft ? "soft_decline" : "payment_method_or_authentication_required", body.attempt);
        } else if ([400, 401, 403, 404].includes(paid.status)) {
          await finish(env, row, "review", "stripe_configuration_error", body.attempt);
        } else {
          await uncertain(env, row);
        }
      }
    } catch {
      // Includes a successful Stripe call followed by a failed D1 write. The
      // persisted attempt/key survives, so recovery cannot issue a new charge.
      await uncertain(env, row);
    }
  }

  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname === "/health" && request.method === "GET") return Response.json({ service: "stripe-dunning", mode: env.STRIPE_MODE ?? null, enabled: enabled(env) });
      if (url.pathname !== "/webhook") return new Response("Not found", { status: 404 });
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      if (!env.STRIPE_WEBHOOK_SECRET || !keyMatchesMode(env)) return new Response("Dunning is not configured", { status: 503 });
      let event: Event;
      try { event = await verifyEvent(await rawBody(request), request.headers.get("stripe-signature") ?? "", env.STRIPE_WEBHOOK_SECRET, now()); }
      catch { return new Response("Invalid signature or body", { status: 400 }); }
      if (!event || typeof event.id !== "string" || !/^evt_[A-Za-z0-9_]+$/.test(event.id) || typeof event.type !== "string" || typeof event.livemode !== "boolean" || event.account) return new Response("Invalid event", { status: 400 });
      if (event.livemode !== (env.STRIPE_MODE === "live")) return new Response("Wrong Stripe mode", { status: 400 });
      if (!EVENTS.has(event.type)) return new Response("OK", { status: 200 });
      if (!validInvoiceId(event.data?.object?.id) || event.data.object.object !== "invoice") return new Response("Invalid invoice", { status: 400 });
      try { await intake(env, event); return new Response("OK", { status: 200 }); }
      catch { log({ event: "dunning_intake_failed", mode: env.STRIPE_MODE }); return new Response("Retry delivery", { status: 503 }); }
    },
    async scheduled(_event: unknown, env: Env): Promise<void> {
      if (!enabled(env) || !keyMatchesMode(env)) return;
      const time = now();
      const rows = await env.DB.prepare(`SELECT invoice_id FROM stripe_dunning_state
        WHERE mode = ? AND status IN ('pending','retrying') AND next_retry_at <= ?
          AND dispatch_after <= ? AND (lease_until IS NULL OR lease_until <= ?)
        ORDER BY next_retry_at LIMIT 100`).bind(env.STRIPE_MODE!, time, time, time).all<{ invoice_id: string }>();
      if (!rows.success) throw new Error("Dunning scan failed");
      for (const row of rows.results) await dispatch(env, row.invoice_id);
    },
    async queue(batch: { messages: QueueMessage[] }, env: Env): Promise<void> {
      for (const message of batch.messages) {
        const body = message.body as RetryMessage | null;
        if (!body || body.version !== 1 || !validInvoiceId(body.invoice_id) || !Number.isInteger(body.attempt) || body.attempt < 1 || body.attempt > 5 || body.mode !== env.STRIPE_MODE) {
          log({ event: "dunning_invalid_message" }); message.ack(); continue;
        }
        if (!enabled(env) || !keyMatchesMode(env)) { message.ack(); continue; }
        try {
          const row = await state(env, body.invoice_id);
          if (!row || terminal(row.status) || body.attempt !== row.attempt + 1) { message.ack(); continue; }
          if (row.next_retry_at !== null && row.next_retry_at > now()) {
            message.retry({ delaySeconds: Math.min(86400, Math.ceil((row.next_retry_at - now()) / 1000)) }); continue;
          }
          await process(env, body);
          message.ack();
        } catch {
          message.retry({ delaySeconds: Math.min(3600, 60 * 2 ** Math.min(message.attempts, 6)) });
        }
      }
    },
  };
}

export default createWorker();
