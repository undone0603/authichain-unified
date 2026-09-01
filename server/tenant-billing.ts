import { getStripe } from "./stripe-service";
import { getDb } from "./db";
import { whiteLabelClients, apiUsageDaily } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";

/**
 * Multi-tenant metered billing for the AuthiChain API Gateway.
 * Uses Stripe's metered billing model with usage-based pricing.
 */

// ─── Pricing by Tier ─────────────────────────────────────────────────────────
const PRICING: Record<string, Record<string, number>> = {
  starter: { verify: 0.02, qr_generate: 0.05, ai_analysis: 0.1 },
  professional: { verify: 0.008, qr_generate: 0.03, ai_analysis: 0.05 },
  enterprise: { verify: 0.003, qr_generate: 0.01, ai_analysis: 0.02 },
};

const RATE_LIMITS: Record<string, { rpm: number; rpd: number }> = {
  free: { rpm: 5, rpd: 10 },
  starter: { rpm: 30, rpd: 5000 },
  professional: { rpm: 60, rpd: 20000 },
  enterprise: { rpm: 200, rpd: 100000 },
};

// ─── Provision a New Tenant ──────────────────────────────────────────────────
export async function provisionTenant(data: {
  userId: number;
  companyName: string;
  domain?: string;
  plan: "free" | "starter" | "professional" | "enterprise";
  verticals?: string[];
}) {
  const stripe = getStripe();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  // Generate API key
  const apiKey = `ac_live_${randomBytes(24).toString("hex")}`;
  const apiSecret = randomBytes(32).toString("hex");

  // Create Stripe customer
  let stripeCustomerId: string | undefined;
  if (data.plan !== "free") {
    const customer = await stripe.customers.create({
      name: data.companyName,
      metadata: { plan: data.plan, apiKey },
    });
    stripeCustomerId = customer.id;
  }

  // Insert tenant record
  // stripeCustomerId is stashed in `features` (rather than a dedicated column)
  // because `whiteLabelClients` has no stripeCustomerId column yet — without
  // this, the Stripe customer created above was created but its id was never
  // persisted anywhere, making it unreachable for later usage reporting or
  // reconciliation. TODO: promote to a real `stripe_customer_id` column via
  // an additive migration once the API-gateway billing model is finalized.
  const features = {
    verticals: data.verticals || ["authichain"],
    pricing_tier: data.plan,
    canVerify: true,
    canGenerateQr: data.plan !== "free",
    canMintNft: data.plan === "enterprise",
    canAccessCannabis: (data.verticals || []).includes("strainchain"),
    stripeCustomerId: stripeCustomerId ?? null,
  };

  const [tenant] = await db
    .insert(whiteLabelClients)
    .values({
      userId: data.userId,
      companyName: data.companyName,
      domain: data.domain || null,
      apiKey,
      apiSecret,
      status: "active",
      monthlyApiCalls: 0,
      apiCallLimit: RATE_LIMITS[data.plan].rpd * 30,
      features,
    })
    .returning();

  return {
    tenantId: tenant.id,
    apiKey,
    apiSecret,
    stripeCustomerId,
    rateLimit: RATE_LIMITS[data.plan],
    plan: data.plan,
  };
}

// ─── Report Usage to Stripe ──────────────────────────────────────────────────
// NOTE: this previously only wrote a local cost estimate to `apiUsageDaily`
// and never told Stripe anything — so metered usage was tracked internally
// but never actually billed to the customer. It now also reports the usage
// via Stripe's Billing Meter Events API (stripe.billing.meterEvents.create),
// keyed by the Stripe customer id already stashed in `features` above, when
// one is present. This requires a Meter named `api_<endpoint>` (or your own
// convention) to exist on the Stripe account and be attached to the
// customer's metered Price — that's a product/pricing decision, not made
// here. Until such a Meter exists, Stripe will reject the event and this
// degrades to local-only tracking (prior behavior) rather than throwing, so
// usage logging never blocks a request.
export async function reportUsageToStripe(
  tenantId: string,
  endpoint: string,
  quantity: number
) {
  const db = await getDb();
  if (!db) return;

  const [tenant] = await db
    .select()
    .from(whiteLabelClients)
    .where(eq(whiteLabelClients.id, tenantId))
    .limit(1);
  if (!tenant) return;

  const features = tenant.features as any;
  const plan = features?.pricing_tier || "starter";
  const pricePerCall = PRICING[plan]?.[endpoint] || 0.02;

  const stripeCustomerId = features?.stripeCustomerId as string | undefined;
  if (stripeCustomerId) {
    try {
      const stripe = getStripe();
      await stripe.billing.meterEvents.create({
        event_name: `api_${endpoint}`,
        payload: {
          stripe_customer_id: stripeCustomerId,
          value: String(quantity),
        },
      });
    } catch (err) {
      // Non-fatal: local usage tracking below still succeeds, and this is
      // logged so billing gaps are visible instead of silently swallowed.
      console.error(
        `[tenant-billing] Stripe usage report failed for tenant ${tenantId}:`,
        err
      );
    }
  }

  // Record in our usage table
  const today = new Date().toISOString().slice(0, 10);
  await db
    .insert(apiUsageDaily)
    .values({
      tenantId,
      date: new Date(today),
      endpoint,
      callCount: quantity,
      cost: (pricePerCall * quantity).toFixed(4),
    })
    .onConflictDoUpdate({
      target: apiUsageDaily.id,
      set: {
        callCount: quantity,
        cost: (pricePerCall * quantity).toFixed(4),
      },
    });
}

// ─── Get Tenant Billing Status ───────────────────────────────────────────────
export async function getTenantBillingStatus(tenantId: string) {
  const db = await getDb();
  if (!db) return null;

  const [tenant] = await db
    .select()
    .from(whiteLabelClients)
    .where(eq(whiteLabelClients.id, tenantId))
    .limit(1);
  if (!tenant) return null;

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";

  // Sum this month's usage
  const usage = await db
    .select()
    .from(apiUsageDaily)
    .where(and(eq(apiUsageDaily.tenantId, tenantId)));

  const monthUsage = usage.filter(u => u.date >= new Date(monthStart));
  const totalCalls = monthUsage.reduce((sum, u) => sum + (u.callCount || 0), 0);
  const totalCost = monthUsage.reduce(
    (sum, u) => sum + parseFloat(u.cost || "0"),
    0
  );

  return {
    tenantId,
    companyName: tenant.companyName,
    plan: (tenant.features as any)?.pricing_tier || "free",
    currentMonth: {
      calls: totalCalls,
      cost: totalCost.toFixed(2),
      limit: tenant.apiCallLimit,
      percentUsed: tenant.apiCallLimit
        ? Math.round((totalCalls / tenant.apiCallLimit) * 100)
        : 0,
    },
    status: tenant.status,
  };
}

// ─── Generate API Key ────────────────────────────────────────────────────────
export function generateApiKey(prefix: string = "ac_live"): string {
  return `${prefix}_${randomBytes(24).toString("hex")}`;
}
