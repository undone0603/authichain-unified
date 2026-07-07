// server/crm/client.ts
// CRM Client - HTTP wrapper for Twenty CRM / HubSpot.
// Swap the base URL and auth header for your CRM of choice.
// All methods are fire-and-forget safe (errors logged, never thrown).

const CRM_BASE_URL = process.env.CRM_BASE_URL ?? '';
const CRM_API_KEY = process.env.CRM_API_KEY ?? '';

function planToMrr(plan_id: string): number {
  switch (plan_id) {
    case 'authichain_basic': return 49;
    case 'authichain_pro': return 149;
    case 'authichain_enterprise': return 499;
    case 'strainchain_basic': return 79;
    case 'strainchain_pro': return 199;
    case 'govchain_basic': return 99;
    case 'govchain_pro': return 299;
    default: return 0;
  }
}

async function crmPost(path: string, body: any): Promise<void> {
  if (!CRM_BASE_URL) {
    console.warn(`CRM: CRM_BASE_URL not set, skipping ${path}`);
    return;
  }
  try {
    const res = await fetch(`${CRM_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CRM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`CRM POST ${path} failed: ${res.status} ${txt}`);
    }
  } catch (err) {
    console.error(`CRM POST ${path} threw:`, err);
  }
}

export async function emitCrmNewSubscription(sub: {
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan_id: string;
  brand: string;
  email: string;
  status: string;
}) {
  await crmPost('/contacts/upsert', {
    email: sub.email,
    stripe_customer_id: sub.stripe_customer_id,
    brand: sub.brand,
  });
  await crmPost('/deals/create', {
    title: `AuthiChain Subscription - ${sub.email}`,
    brand: sub.brand,
    plan_id: sub.plan_id,
    mrr_usd: planToMrr(sub.plan_id),
    stage: 'active',
    metadata: { stripe_subscription_id: sub.stripe_subscription_id },
  });
}

export async function emitCrmVerificationMetric(ev: {
  seal_id: string;
  brand: string;
  verification_id: string;
  status: string;
  scan_context: Record<string, any>;
}) {
  await crmPost('/deals/update', {
    filter: { brand: ev.brand },
    update: {
      increment_scan_volume: 1,
      last_scan_at: new Date().toISOString(),
      last_verification_status: ev.status,
    },
  });
}

export async function emitCrmCertificateOpportunity(ev: {
  certificate_id: string;
  product_id: string;
  brand: string;
  rarity_score: number | null;
}) {
  await crmPost('/deals/create', {
    title: `Certificate Mint - ${ev.product_id}`,
    brand: ev.brand,
    deal_type: 'certificate',
    stage: 'minted',
    metadata: {
      certificate_id: ev.certificate_id,
      product_id: ev.product_id,
      rarity_score: ev.rarity_score,
    },
  });
}

export async function emitCrmDispensaryMetric(ev: {
  seal_id: string;
  brand: string;
  scan_context: Record<string, any>;
  usage_id: string;
}) {
  await crmPost('/deals/update', {
    filter: { brand: ev.brand },
    update: {
      increment_dispensary_scan_volume: 1,
      last_dispensary_scan_at: new Date().toISOString(),
    },
  });
}

export async function emitCrmPaymentFailed(ev: {
  stripe_subscription_id: string;
  stripe_customer_id?: string;
  brand?: string;
  reason?: string;
}) {
  await crmPost('/events/emit', {
    type: 'payment_failed',
    stripe_subscription_id: ev.stripe_subscription_id,
    stripe_customer_id: ev.stripe_customer_id,
    brand: ev.brand,
    reason: ev.reason,
  });
}
