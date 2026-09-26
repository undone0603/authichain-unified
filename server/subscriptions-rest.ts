// server/subscriptions-rest.ts
//
// Subscription state over Supabase REST, for runtimes with no DATABASE_URL.
//
// The authichain.com app Worker handles Stripe webhooks but has no Postgres
// connection string, so Drizzle's getDb() throws there and subscription
// records were never written. The Worker does carry SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY (the DPP activation path already uses them), and
// public.subscriptions is the same table Drizzle maps (camelCase columns), so
// the same rows can be written over PostgREST instead.

type Status = "active" | "cancelled" | "past_due" | "trialing" | "paused";

export interface SubscriptionUpsert {
  userId: number;
  plan: string;
  status: Status;
  monthlyQuota: number;
  billingCycle: "monthly" | "annual";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
}

function creds(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

/** True when Drizzle cannot run here but Supabase REST can. */
export function shouldUseRestFallback(): boolean {
  return !process.env.DATABASE_URL && creds() !== null;
}

async function rest(
  path: string,
  init: RequestInit & { prefer?: string } = {},
  fetchImpl: typeof fetch = fetch
): Promise<any> {
  const c = creds();
  if (!c) throw new Error("Supabase REST credentials are not set");
  const res = await fetchImpl(`${c.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: c.key,
      Authorization: `Bearer ${c.key}`,
      "Content-Type": "application/json",
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(
      `supabase ${init.method ?? "GET"} ${path.split("?")[0]} -> ${res.status} ${(await res.text()).slice(0, 200)}`
    );
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const bySub = (id: string) =>
  `subscriptions?stripeSubscriptionId=eq.${encodeURIComponent(id)}`;

export async function getSubscriptionRest(
  stripeSubscriptionId: string,
  fetchImpl?: typeof fetch
) {
  const rows = await rest(
    `${bySub(stripeSubscriptionId)}&select=*&limit=1`,
    {},
    fetchImpl
  );
  return rows?.[0];
}

export async function upsertSubscriptionRest(
  data: SubscriptionUpsert,
  fetchImpl?: typeof fetch
): Promise<void> {
  const fields = {
    plan: data.plan,
    status: data.status,
    monthlyQuota: data.monthlyQuota,
    billingCycle: data.billingCycle,
    ...(data.stripeCustomerId
      ? { stripeCustomerId: data.stripeCustomerId }
      : {}),
    currentPeriodStart: iso(data.currentPeriodStart),
    currentPeriodEnd: iso(data.currentPeriodEnd),
    ...(data.trialEndsAt ? { trialEndsAt: iso(data.trialEndsAt) } : {}),
    updatedAt: new Date().toISOString(),
  };
  const existing = await getSubscriptionRest(
    data.stripeSubscriptionId,
    fetchImpl
  );
  if (existing) {
    await rest(
      bySub(data.stripeSubscriptionId),
      { method: "PATCH", body: JSON.stringify(fields) },
      fetchImpl
    );
  } else {
    await rest(
      "subscriptions",
      {
        method: "POST",
        prefer: "return=minimal",
        body: JSON.stringify({
          ...fields,
          userId: data.userId,
          stripeSubscriptionId: data.stripeSubscriptionId,
        }),
      },
      fetchImpl
    );
  }
}

export async function setSubscriptionStatusRest(
  stripeSubscriptionId: string,
  status: Status,
  cancelledAt?: Date,
  fetchImpl?: typeof fetch
): Promise<void> {
  await rest(
    bySub(stripeSubscriptionId),
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
        ...(cancelledAt ? { cancelledAt: iso(cancelledAt) } : {}),
        updatedAt: new Date().toISOString(),
      }),
    },
    fetchImpl
  );
}
