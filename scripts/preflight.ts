/**
 * Launch preflight — honest GO / NO-GO readiness check.
 *
 *   pnpm tsx scripts/preflight.ts
 *
 * Inspects the ACTUAL runtime config (env vars, DB connectivity, the payouts
 * table, the safety gates) and prints a per-subsystem readiness report. It
 * makes no changes and moves no money — it only tells you what is wired and
 * what is one setting away from live.
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { ENV } from "../server/_core/env";
import { getDb } from "../server/db";

type Status = "ok" | "warn" | "fail";
interface Check { label: string; status: Status; detail: string; }

const icon = (s: Status) => (s === "ok" ? "✅" : s === "warn" ? "🟡" : "❌");
const has = (v: string) => typeof v === "string" && v.trim().length > 0;

function section(title: string, checks: Check[]) {
  console.log(`\n${title}`);
  for (const c of checks) console.log(`  ${icon(c.status)} ${c.label.padEnd(34)} ${c.detail}`);
  return checks;
}

async function main() {
  console.log("═".repeat(64));
  console.log("  AuthiChain — Launch Preflight");
  console.log("═".repeat(64));

  const all: Check[] = [];

  // ── Core platform ──────────────────────────────────────────────────────────
  all.push(...section("Core platform", [
    { label: "DATABASE_URL", status: has(ENV.databaseUrl) ? "ok" : "fail", detail: has(ENV.databaseUrl) ? "set" : "REQUIRED — Supabase pooler URL" },
    { label: "JWT_SECRET", status: has(ENV.cookieSecret) ? (ENV.cookieSecret.length >= 32 ? "ok" : "warn") : "fail", detail: has(ENV.cookieSecret) ? (ENV.cookieSecret.length >= 32 ? "set (>=32 chars)" : "set but <32 chars — strengthen") : "REQUIRED — auth will refuse to sign sessions" },
    { label: "OPENAI/Forge key", status: has(ENV.openaiApiKey) || has(ENV.forgeApiKey) ? "ok" : "warn", detail: has(ENV.openaiApiKey) || has(ENV.forgeApiKey) ? "set" : "AI drafting/AutoFlow disabled without it" },
  ]));

  // ── Revenue (Stripe) ───────────────────────────────────────────────────────
  all.push(...section("Revenue — Stripe (customers can pay)", [
    { label: "STRIPE_SECRET_KEY", status: has(ENV.stripeSecretKey) ? "ok" : "fail", detail: has(ENV.stripeSecretKey) ? (ENV.stripeSecretKey.startsWith("sk_live") ? "LIVE key" : "TEST key") : "REQUIRED to accept payments" },
    { label: "STRIPE_WEBHOOK_SECRET", status: has(process.env.STRIPE_WEBHOOK_SECRET || "") ? "ok" : "fail", detail: has(process.env.STRIPE_WEBHOOK_SECRET || "") ? "set" : "REQUIRED — provisioning/revenue won't record without it" },
  ]));

  // ── Outbound email ───────────────────────────────────────────────────────
  const emailReady = has(ENV.sendgridApiKey) || has(ENV.gmailRefreshToken) || has(process.env.SMTP_HOST || "");
  all.push(...section("Outreach — email delivery", [
    { label: "SendGrid / Gmail / SMTP", status: emailReady ? "ok" : "warn", detail: emailReady ? "a sender is configured" : "no sender — outreach + access emails won't send" },
    { label: "REQUIRE_OUTREACH_APPROVAL", status: ENV.requireOutreachApproval ? "ok" : "warn", detail: ENV.requireOutreachApproval ? "ON — drafts queue for human review (safe default)" : "OFF — outreach sends without review" },
  ]));

  // ── Payouts (fund movement) ─────────────────────────────────────────────────
  all.push(...section("Payouts — fund movement gates", [
    { label: "PAYOUTS_ENABLED", status: ENV.payoutsEnabled ? "warn" : "ok", detail: ENV.payoutsEnabled ? "ON — approved payouts will send real funds" : "OFF — nothing can send (safe default)" },
    { label: "Caps", status: "ok", detail: `$${ENV.payoutMaxPerItem}/item · $${ENV.payoutMaxPerRun}/run` },
    { label: "QRON_TOKEN_ADDRESS", status: has(ENV.qronTokenAddress) ? "ok" : "warn", detail: has(ENV.qronTokenAddress) ? "set" : "on-chain $QRON payouts disabled until set" },
    { label: "Treasury key", status: has(ENV.blockchainPrivateKey) ? "ok" : "warn", detail: has(ENV.blockchainPrivateKey) ? "set" : "on-chain transfers/burn disabled until set" },
  ]));

  // ── Database connectivity + schema ───────────────────────────────────────────
  const dbChecks: Check[] = [];
  try {
    const db = await getDb();
    if (!db) {
      dbChecks.push({ label: "Connectivity", status: "fail", detail: "getDb() returned null (no DATABASE_URL)" });
    } else {
      await db.execute(sql`select 1`);
      dbChecks.push({ label: "Connectivity", status: "ok", detail: "connected" });
      const tbl = await db.execute(sql`select to_regclass('public.payouts') as t`);
      const exists = (tbl as any).rows?.[0]?.t ?? (tbl as any)[0]?.t;
      dbChecks.push({ label: "payouts table", status: exists ? "ok" : "fail", detail: exists ? "present" : "MISSING — apply drizzle/0001_payouts.sql" });
    }
  } catch (err: any) {
    dbChecks.push({ label: "Connectivity", status: "fail", detail: `error: ${String(err?.message ?? err).slice(0, 80)}` });
  }
  all.push(...section("Database", dbChecks));

  // ── Verdict ──────────────────────────────────────────────────────────────────
  const fails = all.filter(c => c.status === "fail").length;
  const warns = all.filter(c => c.status === "warn").length;
  console.log("\n" + "═".repeat(64));
  if (fails === 0) {
    console.log(`  VERDICT: 🟢 GO — no blockers. ${warns} optional item(s) to review.`);
  } else {
    console.log(`  VERDICT: 🔴 NO-GO — ${fails} blocker(s) (❌) must be fixed before launch.`);
  }
  console.log("═".repeat(64) + "\n");
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("preflight crashed:", err);
  process.exit(1);
});
