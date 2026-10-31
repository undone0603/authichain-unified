import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createWorker, BACKOFF_SECONDS } from "../src/index.ts";

const schema = readFileSync(new URL("../migrations/0001_dunning.sql", import.meta.url), "utf8");
const clone = value => JSON.parse(JSON.stringify(value));
const response = (value, status = 200) => Response.json(value, { status });
const declined = () => response({ error: { type: "card_error", decline_code: "insufficient_funds" } }, 402);

// Runs the production SQL, including conditional UPDATE RETURNING and real
// transactions, against SQLite. This does not emulate D1/Queues deployment.
class LocalD1 {
  sql = new DatabaseSync(":memory:");
  faults = [];
  constructor() { this.sql.exec(schema); }
  failOnce(pattern) { this.faults.push(pattern); }
  prepare(sql) {
    const db = this;
    let params = [];
    function execute(method) {
      const index = db.faults.findIndex(pattern => pattern.test(sql));
      if (index >= 0) { db.faults.splice(index, 1); throw new Error("Injected D1 outage"); }
      const statement = db.sql.prepare(sql);
      if (method === "first") return statement.get(...params) ?? null;
      if (method === "all") return { success: true, results: statement.all(...params), meta: { changes: 0 } };
      return { success: true, results: [], meta: { changes: Number(statement.run(...params).changes) } };
    }
    return {
      bind(...values) { params = values; return this; },
      async first() { return execute("first"); },
      async all() { return execute("all"); },
      async run() { return execute("run"); },
      execute,
    };
  }
  async batch(statements) {
    this.sql.exec("BEGIN");
    try {
      const results = statements.map(statement => statement.execute("run"));
      this.sql.exec("COMMIT");
      return results;
    } catch (error) { this.sql.exec("ROLLBACK"); throw error; }
  }
}

function fixture(t) {
  const db = new LocalD1();
  t.after(() => db.sql.close());
  let time = 1_793_448_000_000;
  const jobs = [];
  const logs = [];
  const calls = [];
  const executions = [];
  const cache = new Map();
  const controls = { queueFails: false, pay: undefined, read: undefined, cache: true };
  const invoice = {
    id: "in_test123", object: "invoice", livemode: false, status: "open",
    customer: "cus_test", collection_method: "charge_automatically",
    auto_advance: false, next_payment_attempt: null,
    metadata: { authichain_dunning_owner: "worker-v1" },
    payments: { has_more: false, data: [{ payment: { type: "payment_intent", payment_intent: {
      id: "pi_test", status: "requires_payment_method",
      last_payment_error: { type: "card_error", decline_code: "insufficient_funds" },
    } } }] },
  };
  const env = {
    DB: db, STRIPE_SECRET_KEY: "sk_test_fixture_only", STRIPE_WEBHOOK_SECRET: "whsec_fixture_only",
    STRIPE_MODE: "test", DUNNING_ENABLED: "true", DUNNING_LIVE_ENABLED: "false",
    DUNNING_QUEUE: { async send(body, options) {
      if (controls.queueFails) throw new Error("Injected queue outage");
      jobs.push({ body: clone(body), delaySeconds: options.delaySeconds, due: time + options.delaySeconds * 1000 });
    } },
  };
  const worker = createWorker({ now: () => time, log: record => logs.push(record), fetch: async (input, init) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://api.stripe.com");
    assert.equal(init.redirect, "error");
    calls.push({ path: url.pathname, method: init.method, key: init.headers["Idempotency-Key"], time });
    if (init.method === "GET") {
      if (controls.read) return controls.read(url, init);
      if (url.pathname.includes("payment_intents")) return response(invoice.payments.data[0].payment.payment_intent);
      return response(clone(invoice));
    }
    assert.equal(init.body, "off_session=true");
    const key = init.headers["Idempotency-Key"];
    if (controls.cache && cache.has(key)) {
      const saved = cache.get(key); return response(saved.data, saved.status);
    }
    executions.push({ key, time });
    const result = controls.pay ? await controls.pay() : declined();
    const data = await result.clone().json();
    if (controls.cache) cache.set(key, { data, status: result.status });
    if (result.status === 200 && data.status === "paid") invoice.status = "paid";
    return result;
  } });
  const event = (type = "invoice.payment_failed", id = "evt_test123", patch = {}) => ({ id, type, created: Math.floor(time / 1000), livemode: false, data: { object: clone(invoice) }, ...patch });
  const sign = (body, seconds = Math.floor(time / 1000), secret = env.STRIPE_WEBHOOK_SECRET) => `t=${seconds},v1=${createHmac("sha256", secret).update(`${seconds}.${body}`).digest("hex")}`;
  async function webhook(value = event(), { signature, body = JSON.stringify(value) } = {}) {
    return worker.fetch(new Request("https://dunning.test/webhook", { method: "POST", body, headers: { "stripe-signature": signature ?? sign(body) } }), env);
  }
  async function deliver(body, advance) {
    if (advance !== undefined) time = advance;
    const outcome = { ack: false, retry: null };
    await worker.queue({ messages: [{ body, attempts: 1, ack() { outcome.ack = true; }, retry(options) { outcome.retry = options; } }] }, env);
    return outcome;
  }
  async function next() {
    jobs.sort((a, b) => a.due - b.due);
    const job = jobs.shift();
    assert.ok(job, "expected queued retry");
    return deliver(job.body, job.due);
  }
  const row = () => db.sql.prepare("SELECT * FROM stripe_dunning_state WHERE invoice_id = ? AND mode = ?").get(invoice.id, "test");
  return { db, env, worker, jobs, logs, calls, executions, controls, invoice, event, sign, webhook, deliver, next, row,
    now: () => time, advance: ms => { time += ms; }, payCalls: () => calls.filter(call => call.method === "POST") };
}

test("migration can be applied twice and does not claim shared fulfillment events", t => {
  const f = fixture(t); f.db.sql.exec(schema);
  assert.equal(f.db.sql.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'stripe_events'").get().n, 0);
});

test("signed failure persists event/state and queues the first attempt after one minute", async t => {
  const f = fixture(t);
  assert.equal((await f.webhook()).status, 200);
  assert.equal(f.row().attempt, 0);
  assert.equal(f.row().next_retry_at, f.now() + 60_000);
  assert.equal(f.jobs[0].delaySeconds, 60);
  assert.equal(f.jobs[0].body.attempt, 1);
  assert.equal(f.payCalls().length, 0);
});

test("five real attempts use all five delays and finish only after attempt five", async t => {
  const f = fixture(t); const start = f.now(); await f.webhook();
  const delays = [];
  for (let attempt = 1; attempt <= 5; attempt++) {
    delays.push(f.jobs[0].delaySeconds);
    assert.equal((await f.next()).ack, true);
    assert.equal(f.row().attempt, attempt);
  }
  assert.deepEqual(delays, [...BACKOFF_SECONDS]);
  assert.deepEqual(f.executions.map(item => (item.time - start) / 1000), [60, 360, 1260, 4860, 26460]);
  assert.equal(f.row().status, "failed_final"); assert.equal(f.jobs.length, 0);
  await f.worker.scheduled({}, f.env); assert.equal(f.executions.length, 5);
});

test("duplicate signed webhooks and stale queue messages do not reset state or repay", async t => {
  const f = fixture(t); const original = f.event();
  await f.webhook(original); await f.webhook(original);
  assert.equal(f.jobs.length, 1);
  const stale = clone(f.jobs[0].body);
  await f.next(); const due = f.row().next_retry_at;
  await f.webhook(f.event("invoice.payment_failed", "evt_different"));
  await f.deliver(stale);
  assert.equal(f.row().next_retry_at, due); assert.equal(f.executions.length, 1);
});

test("concurrent deliveries claim exactly one payment operation", async t => {
  const f = fixture(t); await f.webhook(); const job = f.jobs.shift(); f.advance(60_000);
  await Promise.all([f.deliver(job.body), f.deliver(job.body)]);
  assert.equal(f.executions.length, 1); assert.equal(f.row().attempt, 1);
});

test("early delivery is delayed without making a payment", async t => {
  const f = fixture(t); await f.webhook();
  const outcome = await f.deliver(f.jobs[0].body);
  assert.deepEqual(outcome.retry, { delaySeconds: 60 }); assert.equal(f.executions.length, 0);
});

test("queue outage leaves durable work that cron recovers after the first due time", async t => {
  const f = fixture(t); f.controls.queueFails = true;
  assert.equal((await f.webhook()).status, 200);
  assert.equal(f.row().status, "pending"); assert.equal(f.jobs.length, 0);
  f.controls.queueFails = false; f.advance(60_000);
  await f.worker.scheduled({}, f.env);
  assert.equal(f.jobs.length, 1); assert.equal(f.jobs[0].body.attempt, 1);
  await f.next(); assert.equal(f.executions.length, 1);
});

test("lost queue messages and expired consumer leases are recovered by cron", async t => {
  const f = fixture(t); await f.webhook(); f.jobs.length = 0;
  f.db.sql.prepare("UPDATE stripe_dunning_state SET lease_token = 'dead-process', lease_until = ?").run(f.now() + 120_000);
  f.advance(360_000); await f.worker.scheduled({}, f.env);
  assert.equal(f.jobs.length, 1); await f.next(); assert.equal(f.executions.length, 1);
});

test("D1 transaction failure rolls back the event and returns retryable delivery status", async t => {
  const f = fixture(t); f.db.failOnce(/INSERT INTO stripe_dunning_state/);
  assert.equal((await f.webhook()).status, 503);
  assert.equal(f.db.sql.prepare("SELECT count(*) AS n FROM stripe_dunning_events").get().n, 0);
  assert.equal(f.jobs.length, 0);
  assert.equal((await f.webhook()).status, 200); assert.equal(f.jobs.length, 1);
});

test("transport errors retry the same logical attempt and the same Stripe key", async t => {
  const f = fixture(t); let n = 0;
  f.controls.pay = () => { if (n++ === 0) throw new Error("Network failure"); return declined(); };
  await f.webhook(); await f.next();
  assert.equal(f.row().attempt, 0); assert.ok(f.row().active_started_at);
  await f.next();
  assert.equal(f.payCalls().length, 2);
  assert.equal(f.payCalls()[0].key, f.payCalls()[1].key);
  assert.equal(f.row().attempt, 1);
});

test("payment response lost before D1 commit recovers paid status without another charge", async t => {
  const f = fixture(t);
  f.controls.pay = () => { f.db.failOnce(/SET status = \?, attempt/); return response({ ...f.invoice, status: "paid" }); };
  await f.webhook(); await f.next(); assert.equal(f.row().attempt, 0);
  await f.next(); assert.equal(f.row().status, "paid"); assert.equal(f.executions.length, 1);
});

test("decline committed by Stripe but not D1 is replayed with its original key", async t => {
  const f = fixture(t);
  f.controls.pay = () => { f.db.failOnce(/SET status = \?, attempt/); return declined(); };
  await f.webhook(); await f.next(); assert.equal(f.row().attempt, 0);
  await f.next();
  assert.equal(f.payCalls().length, 2); assert.equal(f.executions.length, 1);
  assert.equal(f.row().attempt, 1);
});

test("ambiguous Stripe 5xx responses never advance the attempt and are bounded", async t => {
  const f = fixture(t); f.controls.pay = () => response({ error: { type: "api_error" } }, 500);
  await f.webhook();
  for (let i = 0; i < 10; i++) await f.next();
  assert.equal(f.row().attempt, 0); assert.equal(f.row().status, "review");
  assert.equal(new Set(f.payCalls().map(call => call.key)).size, 1);
});

test("expired idempotency window requires review rather than a fresh operation", async t => {
  const f = fixture(t); await f.webhook();
  f.db.sql.prepare("UPDATE stripe_dunning_state SET active_started_at = ?").run(f.now() - 23 * 3600_000);
  await f.next(); assert.equal(f.row().status, "review"); assert.equal(f.executions.length, 0);
});

for (const status of ["paid", "void", "uncollectible", "draft"]) test(`current ${status} invoice is never paid again`, async t => {
  const f = fixture(t); await f.webhook(); f.invoice.status = status;
  await f.next(); assert.equal(f.executions.length, 0);
  assert.equal(f.row().status, status === "paid" ? "paid" : "stopped");
});

for (const patch of [{ auto_advance: true }, { next_payment_attempt: 123 }, { collection_method: "send_invoice" }, { metadata: {} }]) test(`invoice ownership gate ${JSON.stringify(patch)}`, async t => {
  const f = fixture(t); await f.webhook(); Object.assign(f.invoice, patch);
  await f.next(); assert.equal(f.row().status, "stopped"); assert.equal(f.executions.length, 0);
});

test("hard decline or customer authentication blocks automatic payment", async t => {
  const f = fixture(t); await f.webhook();
  f.invoice.payments.data[0].payment.payment_intent.last_payment_error.decline_code = "authentication_required";
  await f.next(); assert.equal(f.row().status, "needs_action"); assert.equal(f.executions.length, 0);
});

test("hard decline returned from pay stops the sequence", async t => {
  const f = fixture(t); f.controls.pay = () => response({ error: { type: "card_error", decline_code: "stolen_card" } }, 402);
  await f.webhook(); await f.next(); assert.equal(f.row().status, "needs_action"); assert.equal(f.jobs.length, 0);
});

test("a 200 pay response for an unsettled invoice is not recorded as paid", async t => {
  const f = fixture(t); f.controls.pay = () => response(clone(f.invoice));
  await f.webhook(); await f.next(); assert.equal(f.row().status, "review"); assert.equal(f.jobs.length, 0);
});

test("processing payment intents await settlement without being charged", async t => {
  const f = fixture(t); await f.webhook(); f.invoice.payments.data[0].payment.payment_intent.status = "processing";
  await f.next(); assert.equal(f.row().status, "review"); assert.equal(f.executions.length, 0);
});

test("unexpanded payment intent is retrieved before deciding to pay", async t => {
  const f = fixture(t); await f.webhook();
  f.invoice.payments.data[0].payment.payment_intent = "pi_test";
  f.controls.read = url => url.pathname.includes("payment_intents") ? response({ status: "requires_action" }) : response(clone(f.invoice));
  await f.next(); assert.ok(f.calls.some(call => call.path.endsWith("payment_intents/pi_test")));
  assert.equal(f.row().status, "needs_action"); assert.equal(f.executions.length, 0);
});

test("out of order failure cannot reopen a paid tombstone", async t => {
  const f = fixture(t); await f.webhook(f.event("invoice.paid"));
  await f.webhook(f.event("invoice.payment_failed", "evt_late_failure"));
  assert.equal(f.row().status, "paid"); assert.equal(f.jobs.length, 0);
});

test("terminal webhook arriving during invoice read revokes the charge lease", async t => {
  const f = fixture(t); await f.webhook();
  f.controls.read = async () => { await f.webhook(f.event("invoice.paid", "evt_race_paid")); return response(clone(f.invoice)); };
  await f.next(); assert.equal(f.row().status, "paid"); assert.equal(f.executions.length, 0);
});

test("disabled worker accepts durable intake and only dispatches after activation", async t => {
  const f = fixture(t); f.env.DUNNING_ENABLED = "false";
  assert.equal((await f.webhook()).status, 200); f.advance(60_000);
  await f.worker.scheduled({}, f.env); assert.equal(f.jobs.length, 0);
  f.env.DUNNING_ENABLED = "true"; await f.worker.scheduled({}, f.env); assert.equal(f.jobs.length, 1);
});

test("live mode cannot execute payment unless its separate gate is enabled", async t => {
  const f = fixture(t); f.env.STRIPE_MODE = "live"; f.env.STRIPE_SECRET_KEY = "sk_live_fixture_only";
  await f.webhook(f.event("invoice.payment_failed", "evt_live", { livemode: true }));
  f.advance(60_000); await f.worker.scheduled({}, f.env);
  assert.equal(f.jobs.length, 0); assert.equal(f.calls.length, 0);
});

test("missing secrets and mode/key mismatch fail closed", async t => {
  const f = fixture(t); f.env.STRIPE_SECRET_KEY = "sk_live_fixture_only";
  assert.equal((await f.webhook()).status, 503);
  f.env.STRIPE_SECRET_KEY = "sk_test_fixture_only"; delete f.env.STRIPE_WEBHOOK_SECRET;
  assert.equal((await f.webhook(undefined, { signature: "t=1,v1=00" })).status, 503);
});

test("real asynchronous HMAC rejects wrong, absent, tampered, stale and future signatures", async t => {
  const f = fixture(t); const body = JSON.stringify(f.event());
  const invalid = ["", "t=1,v1=bad", f.sign(body, Math.floor(f.now() / 1000) - 301), f.sign(body, Math.floor(f.now() / 1000) + 301), f.sign(body, undefined, "wrong_secret"), f.sign(body + " ")];
  for (const signature of invalid) assert.equal((await f.webhook(undefined, { body, signature })).status, 400);
  assert.equal(f.row(), undefined); assert.equal(f.calls.length, 0);
});

test("signature rotation headers allow any valid v1 signature", async t => {
  const f = fixture(t); const body = JSON.stringify(f.event());
  assert.equal((await f.webhook(undefined, { body, signature: f.sign(body) + ",v1=" + "0".repeat(64) })).status, 200);
});

test("signed wrong-mode or Connect events cannot reach D1", async t => {
  const f = fixture(t);
  assert.equal((await f.webhook(f.event("invoice.payment_failed", "evt_wrong", { livemode: true }))).status, 400);
  assert.equal((await f.webhook(f.event("invoice.payment_failed", "evt_connect", { account: "acct_elsewhere" }))).status, 400);
  assert.equal(f.row(), undefined);
});

test("malformed queue bodies are acknowledged without touching Stripe", async t => {
  const f = fixture(t);
  for (const body of [null, {}, { version: 1, invoice_id: "../../customers", mode: "test", attempt: 1 }, { version: 1, invoice_id: "in_test123", mode: "test", attempt: 6 }]) assert.equal((await f.deliver(body)).ack, true);
  assert.equal(f.calls.length, 0);
});

test("oversized request is rejected before persistence", async t => {
  const f = fixture(t); const body = " ".repeat(262_145);
  assert.equal((await f.webhook(undefined, { body })).status, 400); assert.equal(f.row(), undefined);
});

test("invoice identity mismatch cannot trigger a payment", async t => {
  const f = fixture(t); await f.webhook(); f.invoice.livemode = true;
  await f.next(); assert.equal(f.row().status, "review"); assert.equal(f.executions.length, 0);
});
