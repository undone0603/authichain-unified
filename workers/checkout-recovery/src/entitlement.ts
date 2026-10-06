import { grantForSku } from "../../../src/lib/cash-entitlement";

export interface EntitlementEnv {
  DB: D1Database;
}

export async function grantEntitlement(
  env: EntitlementEnv,
  session: {
    id: string;
    payment_status?: string;
    customer_email?: string | null;
    metadata?: { plan?: string; sku?: string };
  },
): Promise<{ event: string; generations?: number }> {
  if (session.payment_status && session.payment_status !== "paid") {
    return { event: "entitlement_skip_unpaid" };
  }
  const sku = session.metadata?.plan || session.metadata?.sku || "";
  const grant = grantForSku(sku);
  const email = (session.customer_email || "").trim().toLowerCase();
  if (!grant) return { event: "entitlement_skip_sku" };
  if (!email) {
    console.log(JSON.stringify({ level: "warn", event: "entitlement_skip_no_email", sessionId: session.id, sku }));
    return { event: "entitlement_skip_no_email" };
  }
  await env.DB.prepare(
    `INSERT OR IGNORE INTO entitlements
       (session_id, email, sku, generations, amount_cents, credit_cents, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
  )
    .bind(session.id, email, sku, grant.generations, grant.amountCents, Date.now())
    .run();
  console.log(JSON.stringify({ level: "info", event: "entitlement_granted", sessionId: session.id, sku, generations: grant.generations }));
  return { event: "entitlement_granted", generations: grant.generations };
}
