// server/revenue-engine/handlers.ts
import { emitCrmNewSubscription, emitCrmVerificationMetric, emitCrmCertificateOpportunity, emitCrmDispensaryMetric } from "../crm/client";
import type {
  VerificationEvent,
  CertificateMintedEvent,
  ScanEvent,
  SubscriptionCreatedEvent,
  PaymentFailedEvent,
} from "./events";

export type { VerificationEvent, CertificateMintedEvent, ScanEvent, SubscriptionCreatedEvent, PaymentFailedEvent };

async function supabaseInsert(table: string, row: any) {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase insert ${table} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function supabaseUpsert(table: string, row: any, conflictKey = "stripe_subscription_id") {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
      "Prefer-Conflict": conflictKey,
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert ${table} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function handleVerificationEvent(ev: VerificationEvent) {
  try {
    const verificationRow = {
      seal_id: ev.seal_id,
      brand: ev.brand,
      scan_context: ev.scan_context || {},
      status: ev.status,
    };
    const inserted = await supabaseInsert("verification_events", verificationRow);
    const verificationId = inserted[0]?.id;

    await supabaseInsert("usage_events", {
      subscription_id: null,
      event_type: "verification",
      event_ref: verificationId,
      brand: ev.brand,
    });

    try {
      await emitCrmVerificationMetric({
        seal_id: ev.seal_id,
        brand: ev.brand,
        verification_id: verificationId,
        status: ev.status,
        scan_context: ev.scan_context || {},
      });
    } catch (crmErr) {
      console.error("handleVerificationEvent: CRM emit failed", crmErr);
    }

    return { ok: true, verificationId };
  } catch (err) {
    console.error("handleVerificationEvent error:", err);
    throw err;
  }
}

export async function handleCertificateMint(ev: CertificateMintedEvent) {
  try {
    const certRow = {
      product_id: ev.product_id,
      seal_id: ev.seal_id,
      rarity_score: ev.rarity_score ?? null,
      polygon_nft_tx: ev.polygon_nft_tx ?? null,
      brand: ev.brand,
    };
    const inserted = await supabaseInsert("certificates", certRow);
    const certId = inserted[0]?.id;

    await supabaseInsert("usage_events", {
      subscription_id: null,
      event_type: "certificate_mint",
      event_ref: certId,
      brand: ev.brand,
    });

    try {
      await emitCrmCertificateOpportunity({
        certificate_id: certId,
        product_id: ev.product_id,
        brand: ev.brand,
        rarity_score: ev.rarity_score ?? null,
      });
    } catch (crmErr) {
      console.error("handleCertificateMint: CRM emit failed", crmErr);
    }

    return { ok: true, certificateId: certId };
  } catch (err) {
    console.error("handleCertificateMint error:", err);
    throw err;
  }
}

export async function handleDispensaryScan(ev: ScanEvent) {
  try {
    const usage = await supabaseInsert("usage_events", {
      subscription_id: null,
      event_type: "dispensary_scan",
      event_ref: ev.id ?? null,
      brand: ev.brand,
    });

    try {
      await emitCrmDispensaryMetric({
        dispensary_id: ev.dispensary_id,
        batch_id: ev.batch_id,
        brand: ev.brand,
        scan_context: ev.scan_context ?? {},
        usage_id: usage[0]?.id,
      });
    } catch (crmErr) {
      console.error("handleDispensaryScan: CRM emit failed", crmErr);
    }

    return { ok: true, usageId: usage[0]?.id };
  } catch (err) {
    console.error("handleDispensaryScan error:", err);
    throw err;
  }
}

export async function handleSubscriptionCreated(ev: SubscriptionCreatedEvent) {
  try {
    const row = {
      stripe_customer_id: ev.stripe_customer_id,
      stripe_subscription_id: ev.stripe_subscription_id,
      plan_id: ev.plan_id,
      brand: ev.brand,
      email: ev.email,
      status: ev.status,
      current_period_end: ev.current_period_end ?? null,
    };

    const upserted = await supabaseUpsert("subscriptions", row, "stripe_subscription_id");

    try {
      await emitCrmNewSubscription(row);
    } catch (crmErr) {
      console.error("handleSubscriptionCreated: CRM emit failed", crmErr);
    }

    return { ok: true, subscription: upserted[0] };
  } catch (err) {
    console.error("handleSubscriptionCreated error:", err);
    throw err;
  }
}

export async function handlePaymentFailed(ev: PaymentFailedEvent) {
  try {
    if (!ev.stripe_subscription_id) {
      console.warn("handlePaymentFailed: missing stripe_subscription_id");
    } else {
      const SUPABASE_URL = process.env.SUPABASE_URL!;
      const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?stripe_subscription_id=eq.${ev.stripe_subscription_id}`, {
        method: "PATCH",
        headers: {
          apikey: SERVICE_ROLE,
          Authorization: `Bearer ${SERVICE_ROLE}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ status: "past_due" }),
      });
      if (!updateRes.ok) {
        const txt = await updateRes.text();
        console.error("handlePaymentFailed: subscription update failed", updateRes.status, txt);
      }
    }

    try {
      await supabaseInsert("payment_failures", {
        stripe_subscription_id: ev.stripe_subscription_id ?? null,
        stripe_customer_id: ev.stripe_customer_id ?? null,
        brand: ev.brand ?? null,
        reason: ev.reason ?? null,
        invoice_id: ev.invoice_id ?? null,
        occurred_at: ev.occurred_at ?? new Date().toISOString(),
      });
    } catch (pfErr) {
      console.warn("handlePaymentFailed: could not insert payment_failures", pfErr);
    }

    try {
      await fetch(`${process.env.CRM_BASE_URL}/events/emit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CRM_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "payment_failed",
          stripe_subscription_id: ev.stripe_subscription_id,
          stripe_customer_id: ev.stripe_customer_id,
          brand: ev.brand,
          reason: ev.reason,
        }),
      });
    } catch (crmErr) {
      console.error("handlePaymentFailed: CRM emit failed", crmErr);
    }

    return { ok: true };
  } catch (err) {
    console.error("handlePaymentFailed error:", err);
    throw err;
  }
}
