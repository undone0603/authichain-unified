import { reconcile } from "./reconcile";
import type { ReconInput, ReconSummary } from "./types";
import allowlistFile from "../../../ops/reconcile/excluded-test-payments.json";

export interface Env {
  DRY_RUN?: string;
  SUPABASE_URL: string;
  STRIPE_RECON_RESTRICTED_KEY: string; // secret, restricted read-only
  SUPABASE_ANON_KEY: string;           // secret
  RECON_DB_JWT: string;                // secret, role claim = stripe_reconciler
}

export const isDryRun = (env: Pick<Env, "DRY_RUN">) => (env.DRY_RUN ?? "true").toLowerCase() !== "false";

/** Refuse anything but the dedicated restricted role. Never logs the token. */
export function assertRestrictedRole(jwt: string): void {
  let role: unknown;
  try {
    const b64 = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    role = JSON.parse(atob(b64)).role;
  } catch { throw new Error("RECON_DB_JWT unreadable"); }
  if (role !== "stripe_reconciler") throw new Error("RECON_DB_JWT must carry role stripe_reconciler");
}
export function assertRestrictedStripeKey(key: string): void {
  if (!key.startsWith("r" + "k_live_")) throw new Error("STRIPE_RECON_RESTRICTED_KEY must be a restricted key");
}

async function stripeList(env: Env, path: string, params: Record<string, string>): Promise<any[]> {
  const out: any[] = [];
  let after: string | undefined;
  for (let i = 0; i < 50; i++) {
    const q = new URLSearchParams({ limit: "100", ...params, ...(after ? { starting_after: after } : {}) });
    const r = await fetch(`https://api.stripe.com/v1/${path}?${q}`, {
      headers: { Authorization: `Bearer ${env.STRIPE_RECON_RESTRICTED_KEY}` },
    });
    if (!r.ok) throw new Error(`stripe ${path} HTTP ${r.status}`);
    const j: any = await r.json();
    out.push(...j.data);
    if (!j.has_more) break;
    after = j.data[j.data.length - 1].id;
  }
  return out;
}

async function db(env: Env, path: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.RECON_DB_JWT}`,
      "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`supabase ${path.split("?")[0]} HTTP ${r.status}`);
  return init.method === "POST" ? null : r.json();
}

export async function gather(env: Env, now: Date): Promise<ReconInput> {
  const full = now.getUTCDay() === 0;
  const start = full ? new Date(0) : new Date(now.getTime() - 48 * 3600e3);
  const gte = String(Math.floor(start.getTime() / 1000));
  const created = { "created[gte]": gte };
  const [charges, sessions, payouts] = await Promise.all([
    stripeList(env, "charges", created),
    stripeList(env, "checkout/sessions", { ...created, status: "complete" }),
    stripeList(env, "payouts", created),
  ]);
  const payoutRows = [];
  for (const p of payouts) {
    const bts = await stripeList(env, "balance_transactions", { payout: p.id });
    const sum = bts.filter((b) => b.type !== "payout").reduce((a, b) => a + b.net, 0);
    payoutRows.push({ id: p.id, amount: p.amount, livemode: p.livemode, balance_txn_sum: sum });
  }
  const iso = start.toISOString();
  const ledger = await db(env, `payments?select=session_id,amount_cents,currency,status&created_at=gte.${iso}`);
  const events = await db(env, `stripe_events?select=event_id,event_type,status&processed_at=gte.${iso}`);
  return {
    windowStart: iso, windowEnd: now.toISOString(),
    charges: charges.map((c) => ({ id: c.id, payment_intent: c.payment_intent, amount: c.amount,
      amount_refunded: c.amount_refunded, currency: c.currency, status: c.status, refunded: c.refunded,
      livemode: c.livemode, metadata: c.metadata?.test_payment ? { test_payment: c.metadata.test_payment } : {} })),
    sessions: sessions.map((s) => ({ id: s.id, payment_intent: s.payment_intent, livemode: s.livemode, status: s.status })),
    payouts: payoutRows, ledger, events, allowlist: allowlistFile.ids,
  };
}

export function toRow(s: ReconSummary) {
  const { customer_revenue_cents: _r, ...row } = s;
  return row;
}

export async function run(env: Env, now = new Date()): Promise<ReconSummary> {
  assertRestrictedStripeKey(env.STRIPE_RECON_RESTRICTED_KEY);
  assertRestrictedRole(env.RECON_DB_JWT);
  const summary = reconcile(await gather(env, now));
  console.log(JSON.stringify({ dry_run: isDryRun(env), ...summary }));
  if (!isDryRun(env)) {
    await db(env, "reconciliation_runs", { method: "POST", body: JSON.stringify(toRow(summary)),
      headers: { Prefer: "return=minimal" } });
  }
  return summary;
}

export default {
  async scheduled(_e: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(run(env).then(() => undefined));
  },
};
