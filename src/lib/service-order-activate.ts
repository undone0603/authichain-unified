import {
  appendServiceOrderEventOnce,
  isServiceOrderPlanId,
  serviceOrderPriceId,
  type ServiceOrderPlanId,
} from "./service-order";

type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

type Contact = { name?: unknown; email?: unknown };
type Intake = Record<string, unknown> & {
  session_id?: unknown;
  plan?: unknown;
  contact?: Contact;
};

export type ServiceOrderActivationResult =
  | {
      ok: true;
      plan: ServiceOrderPlanId;
      order_key: string;
      already_activated: boolean;
      status: "intake_accepted";
    }
  | { ok: false; status: number; error: string };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isPlainEmail(value: string): boolean {
  if (value.length === 0 || value.length > 254) return false;
  let at = -1;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 32 || code === 127) return false;
    if (value[i] === "@") {
      if (at !== -1) return false;
      at = i;
    }
  }
  if (at <= 0 || at >= value.length - 1) return false;
  const dot = value.indexOf(".", at + 1);
  return dot > at + 1 && dot < value.length - 1;
}

function hasContact(value: unknown): value is Contact {
  return Boolean(
    value &&
    typeof value === "object" &&
    text((value as Contact).name) &&
    isPlainEmail(text((value as Contact).email))
  );
}

function hasSupplierOriginRecords(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      record =>
        record &&
        typeof record === "object" &&
        text((record as Record<string, unknown>).supplier) &&
        text((record as Record<string, unknown>).origin)
    )
  );
}

function validateIntake(
  plan: ServiceOrderPlanId,
  intake: Intake
): string | null {
  if (plan === "strainchain_passport") {
    return text(intake.farm) &&
      text(intake.cultivar) &&
      Array.isArray(intake.coa_references) &&
      intake.coa_references.every(text) &&
      intake.coa_references.length > 0
      ? null
      : "farm, cultivar, and at least one CoA reference are required";
  }
  if (plan === "strainchain_farm") {
    return text(intake.farm_identity) &&
      hasContact(intake.contact) &&
      text(intake.initial_library_config) &&
      text(intake.initial_coa_config)
      ? null
      : "farm_identity, contact, initial_library_config, and initial_coa_config are required";
  }
  if (plan === "musa_claim_file") {
    return text(intake.sku) &&
      text(intake.company) &&
      hasContact(intake.contact) &&
      hasSupplierOriginRecords(intake.supplier_origin_records)
      ? null
      : "sku, company, contact, and supplier_origin_records are required";
  }
  return text(intake.company) &&
    hasContact(intake.contact) &&
    hasSupplierOriginRecords(intake.supplier_origin_records) &&
    Number.isInteger(intake.skuCount) &&
    Number(intake.skuCount) >= 1 &&
    Number(intake.skuCount) <= 10
    ? null
    : "company, contact, supplier_origin_records, and skuCount (1-10) are required";
}

export async function activateServiceOrder(opts: {
  body: Intake;
  authenticatedUser: { id: string; email?: string | null } | null;
  stripeSecretKey: string;
  supabase: SupabaseLike | null;
}): Promise<ServiceOrderActivationResult> {
  if (!opts.authenticatedUser?.id)
    return { ok: false, status: 401, error: "Authentication required" };
  const sessionId = text(opts.body.session_id);
  if (!sessionId || !isServiceOrderPlanId(opts.body.plan)) {
    return {
      ok: false,
      status: 400,
      error: "A service-order plan and session_id are required",
    };
  }
  const plan = opts.body.plan;
  const validationError = validateIntake(plan, opts.body);
  if (validationError)
    return { ok: false, status: 400, error: validationError };
  if (!opts.stripeSecretKey)
    return { ok: false, status: 500, error: "Stripe is not configured" };
  if (!opts.supabase)
    return { ok: false, status: 500, error: "Database not configured" };

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(opts.stripeSecretKey, {
    apiVersion: "2026-08-26.dahlia" as const,
  });
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items"],
  });
  if (session.payment_status !== "paid" || session.status !== "complete") {
    return {
      ok: false,
      status: 402,
      error: "Checkout session is not complete and paid",
    };
  }
  if (
    session.metadata?.plan !== plan ||
    session.line_items?.data?.length !== 1 ||
    session.line_items.data[0]?.price?.id !== serviceOrderPriceId(plan)
  ) {
    return {
      ok: false,
      status: 400,
      error: "Checkout session does not match the requested service order",
    };
  }
  const buyerEmail = text(
    session.customer_details?.email || session.customer_email
  ).toLowerCase();
  if (
    !buyerEmail ||
    buyerEmail !== text(opts.authenticatedUser.email).toLowerCase()
  ) {
    return {
      ok: false,
      status: 403,
      error: "Authenticated user does not own this checkout session",
    };
  }

  const common = {
    plan,
    sessionId,
    email: buyerEmail,
    metadata: { intake: opts.body, accepted_by: opts.authenticatedUser.id },
  };
  const requested = await appendServiceOrderEventOnce(opts.supabase, {
    ...common,
    stage: "activation_requested",
  });
  const activated = await appendServiceOrderEventOnce(opts.supabase, {
    ...common,
    stage: "activated",
  });
  return {
    ok: true,
    plan,
    order_key: activated.orderKey,
    already_activated: !requested.recorded && !activated.recorded,
    status: "intake_accepted",
  };
}
