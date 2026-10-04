import { planById, type PlanId } from "./plans";

export const SERVICE_ORDER_PLAN_IDS = [
  "strainchain_passport",
  "strainchain_farm",
  "musa_claim_file",
  "musa_audit_bundle",
] as const;

export type ServiceOrderPlanId = (typeof SERVICE_ORDER_PLAN_IDS)[number];
export type ServiceOrderStage =
  | "payment_succeeded"
  | "provisioned"
  | "activation_requested"
  | "activated"
  | "blocked"
  | "failed";

type FunnelStage = "complete_checkout" | "subscribe";
type FunnelSource =
  | "seo"
  | "direct"
  | "email"
  | "affiliate"
  | "linkedin_post"
  | "reddit_post"
  | "gov_engine";
type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

const STAGE_TO_FUNNEL: Record<ServiceOrderStage, FunnelStage> = {
  payment_succeeded: "complete_checkout",
  provisioned: "complete_checkout",
  activation_requested: "subscribe",
  activated: "subscribe",
  blocked: "subscribe",
  failed: "subscribe",
};

function normalizeSource(source: string | undefined): FunnelSource {
  const allowed: FunnelSource[] = [
    "seo",
    "direct",
    "email",
    "affiliate",
    "linkedin_post",
    "reddit_post",
    "gov_engine",
  ];
  return allowed.includes(source as FunnelSource)
    ? (source as FunnelSource)
    : "direct";
}

export type ServiceOrderSession = {
  id: string;
  metadata?: Record<string, unknown> | null;
  line_items?: {
    data?: Array<{ price?: { id?: string | null } | null }>;
  } | null;
};

export function isServiceOrderPlanId(
  value: unknown
): value is ServiceOrderPlanId {
  return (
    typeof value === "string" &&
    (SERVICE_ORDER_PLAN_IDS as readonly string[]).includes(value)
  );
}

export function serviceOrderKey(
  plan: ServiceOrderPlanId,
  sessionId: string
): string {
  if (!sessionId.trim())
    throw new Error("Service order requires a Stripe session id");
  return `service_order:${plan}:${sessionId}`;
}

export function serviceOrderPriceId(plan: ServiceOrderPlanId): string {
  const priceId = planById(plan)?.stripe_price_id;
  if (!priceId)
    throw new Error(`Service order plan ${plan} has no Stripe price`);
  return priceId;
}

export function validateServiceOrderSession(
  plan: ServiceOrderPlanId,
  session: ServiceOrderSession
): string {
  const declaredPlan = session.metadata?.plan;
  if (declaredPlan !== undefined && declaredPlan !== plan) {
    throw new Error(`Service order session plan does not match ${plan}`);
  }
  const priceId =
    session.line_items?.data?.[0]?.price?.id ||
    (typeof session.metadata?.stripe_price_id === "string"
      ? session.metadata.stripe_price_id
      : null);
  if (priceId !== serviceOrderPriceId(plan)) {
    throw new Error(`Service order session price does not match ${plan}`);
  }
  return serviceOrderKey(plan, session.id);
}

export async function appendServiceOrderEventOnce(
  supabase: SupabaseLike,
  input: {
    plan: ServiceOrderPlanId;
    sessionId: string;
    stage: ServiceOrderStage;
    source?: string;
    email?: string | null;
    profileId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<{ recorded: boolean; orderKey: string }> {
  /*
   * funnel_events currently has no unique constraint on
   * (prospect_id, event_type), so this read-then-insert guard only
   * deduplicates serial deliveries; it is not database-concurrency-safe.
   * The database owner must add that unique constraint before this can become
   * an atomic INSERT ... ON CONFLICT DO NOTHING operation.
   */
  const orderKey = serviceOrderKey(input.plan, input.sessionId);
  const eventType = `service_order:${input.stage}`;
  const { data, error: readError } = await supabase
    .from("funnel_events")
    .select("id")
    .eq("prospect_id", orderKey)
    .eq("event_type", eventType)
    .limit(1);
  if (readError) {
    throw new Error(
      `Service order lifecycle lookup failed: ${readError.message || String(readError)}`
    );
  }
  if (Array.isArray(data) && data.length > 0) {
    return { recorded: false, orderKey };
  }

  const { error: insertError } = await supabase.from("funnel_events").insert({
    prospect_id: orderKey,
    stage: STAGE_TO_FUNNEL[input.stage],
    source: normalizeSource(input.source),
    event_type: eventType,
    metadata: {
      service_order_stage: input.stage,
      plan: input.plan,
      stripe_session_id: input.sessionId,
      ...(input.email ? { email: input.email } : {}),
      ...(input.profileId ? { profile_id: input.profileId } : {}),
      ...(input.metadata || {}),
    },
    timestamp: new Date().toISOString(),
  });
  if (insertError) {
    throw new Error(
      `Service order lifecycle append failed: ${insertError.message || String(insertError)}`
    );
  }
  return { recorded: true, orderKey };
}
