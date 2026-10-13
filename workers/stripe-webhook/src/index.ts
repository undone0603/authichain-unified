import Stripe from "stripe";
import {
  grantForPrice,
  grantReplayAction,
  isFounderEmail,
  loopForPlan,
} from "./grant-map";

export interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

async function supabaseUpsert(
  env: Env,
  table: string,
  data: Record<string, unknown>,
  onConflict?: string
): Promise<boolean> {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}${
    onConflict ? `?on_conflict=${onConflict}` : ""
  }`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function supabaseSelectOne(
  env: Env,
  table: string,
  match: Record<string, string>,
  columns: string
): Promise<
  { ok: true; row: Record<string, unknown> | null } | { ok: false }
> {
  const params = Object.entries(match)
    .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
    .join("&");
  const url = `${env.SUPABASE_URL}/rest/v1/${table}?${params}&select=${encodeURIComponent(columns)}&limit=1`;
  try {
    const res = await fetch(url, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!res.ok) return { ok: false };
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) return { ok: false };
    if (rows.length === 0 || typeof rows[0] !== "object" || rows[0] === null) {
      return { ok: true, row: null };
    }
    return { ok: true, row: rows[0] as Record<string, unknown> };
  } catch {
    return { ok: false };
  }
}

function grantRetry(error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}

async function supabaseUpdate(
  env: Env,
  table: string,
  match: Record<string, string>,
  data: Record<string, unknown>
): Promise<boolean> {
  const params = Object.entries(match)
    .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
    .join("&");
  const url = `${env.SUPABASE_URL}/rest/v1/${table}?${params}`;
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value.toLowerCase().trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Record the loop purchase event (LOOP-03 contract,
 * docs/growth/2026-09-28-first-dollar-loops.md). This is the only event that
 * proves revenue, and every kill criterion counts NON-founder purchases only,
 * so the founder flag is set here rather than inferred later.
 *
 * Only a SHA-256 digest of the email is sent. Never throws: a missed analytics
 * write must not cause Stripe to retry a webhook that already granted credits.
 */
async function recordPurchaseEvent(
  env: Env,
  plan: string | null | undefined,
  email: string | null | undefined
): Promise<void> {
  const identity = loopForPlan(plan);
  if (!identity) return; // creator, qron_launch, strainchain_farm have no loop.
  try {
    const body: Record<string, unknown> = {
      p_event: identity.purchaseEvent,
      p_loop: identity.loop,
      p_sku: plan,
      p_founder: isFounderEmail(email),
      p_occurred_at: new Date().toISOString(),
    };
    if (email) body.p_email_hash = await sha256Hex(email);

    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/growth_record_event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(
        JSON.stringify({
          evt: "growth_event_failed",
          event: identity.purchaseEvent,
          status: res.status,
          detail: await res.text(),
        })
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        evt: "growth_event_error",
        event: identity.purchaseEvent,
        detail: err instanceof Error ? err.message : String(err),
      })
    );
  }
}

function priceIdFromSession(session: Stripe.Checkout.Session): string | null {
  const fromMeta = session.metadata?.stripe_price_id?.trim();
  if (fromMeta) return fromMeta;
  const item = session.line_items?.data?.[0];
  const price = item?.price;
  if (price && typeof price === "object" && "id" in price) return price.id;
  if (typeof price === "string") return price;
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-08-26.dahlia" as const,
    });

    const signature = request.headers.get("stripe-signature");
    if (!signature) return new Response("Missing signature", { status: 400 });

    let event: Stripe.Event;
    try {
      const body = await request.text();
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return new Response(`Error: ${msg}`, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_details?.email;
      const name = session.customer_details?.name || "QRON User";
      const customerId =
        typeof session.customer === "string" ? session.customer : null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;
      const grant = grantForPrice(priceIdFromSession(session));
      const plan = grant?.plan || session.metadata?.plan || "starter";

      if (email) {
        const upserted = await supabaseUpsert(
          env,
          "profiles",
          {
            email,
            full_name: name,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan,
            updated_at: new Date().toISOString(),
          },
          "email"
        );
        if (!upserted) return grantRetry("profile upsert failed");
        // Unified grant rail: SET not +=. Matches provisionPurchase.
        if (grant) {
          const existing = await supabaseSelectOne(
            env,
            "profiles",
            { email },
            "last_grant_session_id"
          );
          const prior =
            existing.ok &&
            typeof existing.row?.last_grant_session_id === "string"
              ? existing.row.last_grant_session_id
              : null;
          const action = grantReplayAction(
            existing.ok ? { ok: true, sessionId: prior } : { ok: false },
            session.id
          );
          if (action === "retry") return grantRetry("grant lookup failed");
          if (action === "skip") {
            console.log(
              JSON.stringify({
                evt: "stripe_grant_skipped_idempotent",
                session: session.id,
                plan: grant.plan,
              })
            );
          } else {
            console.log(
              JSON.stringify({
                evt: "stripe_grant_set",
                plan: grant.plan,
                generations_limit: grant.generations,
                generations_used: 0,
                refill: grant.refillOnInvoicePaid,
              })
            );
            const wrote = await supabaseUpdate(
              env,
              "profiles",
              { email },
              {
                plan: grant.plan,
                generations_limit: grant.generations,
                generations_used: 0,
                last_grant_session_id: session.id,
                updated_at: new Date().toISOString(),
              }
            );
            if (!wrote) return grantRetry("grant write failed");
          }
        }
      }

      // After the grant, so a failed analytics write can never cost credits.
      //
      // Pass grant?.plan, NOT the `plan` above: that falls back to "starter"
      // when the price is unmapped, which is harmless for the profiles upsert
      // but would record a false purchase_starter_succeeded — the single metric
      // the first-dollar kill decision reads. An unmapped price gets no event.
      await recordPurchaseEvent(env, grant?.plan ?? null, email);
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      if (customerId) {
        await supabaseUpdate(
          env,
          "profiles",
          { stripe_customer_id: customerId },
          {
            stripe_subscription_status: sub.status,
            updated_at: new Date().toISOString(),
          }
        );
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : null;
      const line = invoice.lines?.data?.[0] as
        | { price?: { id?: string } | string | null }
        | undefined;
      const price = line?.price;
      const linePrice =
        price && typeof price === "object" ? (price.id ?? null) : null;
      const grant = grantForPrice(linePrice);
      // One-time packs (starter/creator/dpp/passport): refillOnInvoicePaid=false — no-op.
      // Launch/Farm subscriptions: SET the period grant, used=0. Never +=.
      if (customerId && grant?.refillOnInvoicePaid) {
        console.log(
          JSON.stringify({
            evt: "stripe_grant_refill",
            plan: grant.plan,
            generations_limit: grant.generations,
            generations_used: 0,
          })
        );
        await supabaseUpdate(
          env,
          "profiles",
          { stripe_customer_id: customerId },
          {
            plan: grant.plan,
            generations_limit: grant.generations,
            generations_used: 0,
            updated_at: new Date().toISOString(),
          }
        );
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : null;
      if (customerId) {
        await supabaseUpdate(
          env,
          "profiles",
          { stripe_customer_id: customerId },
          {
            stripe_subscription_status: "past_due",
            updated_at: new Date().toISOString(),
          }
        );
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
