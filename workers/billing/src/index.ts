import Stripe from "stripe";

export interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  BILLING_QUEUE: Queue;
  DB: D1Database;
  NTFY_URL?: string;
}

const FREE_PROTOCOL_MONTHLY = 10;
const FREE_AI_LIFETIME = 5;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") return new Response("ok");
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");
    if (!sig) return new Response("missing signature", { status: 400 });

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-08-26.dahlia" as const,
    });

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        sig,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch {
      return new Response("invalid signature", { status: 400 });
    }

    if (
      event.type === "invoice.paid" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created"
    ) {
      await env.BILLING_QUEUE.send({
        type: "sync_entitlement",
        data: event.data.object,
      });
    }

    if (event.type === "invoice.payment_failed") {
      await env.BILLING_QUEUE.send({
        type: "dunning",
        data: event.data.object,
        attempt: 1,
      });
    }

    return new Response(JSON.stringify({ received: true }));
  },

  async queue(batch: MessageBatch, env: Env) {
    for (const msg of batch.messages) {
      const body = msg.body as {
        type: string;
        data: any;
        attempt?: number;
      };
      const attempt = body.attempt ?? 1;

      if (body.type === "dunning" && attempt <= 4) {
        // Draft only. Do not send customer email without founder yes.
        console.log(
          JSON.stringify({
            event: "dunning_attempt",
            attempt,
            customer: body.data?.customer,
          })
        );
        if (attempt === 4 && env.NTFY_URL) {
          await fetch(env.NTFY_URL, {
            method: "POST",
            body: `Dunning exhausted for customer ${body.data?.customer}`,
          });
        } else if (attempt < 4) {
          const delays = [3600, 21600, 86400, 259200];
          await env.BILLING_QUEUE.send(
            { ...body, attempt: attempt + 1 },
            { delaySeconds: delays[attempt - 1] }
          );
        }
      }

      if (body.type === "report_usage") {
        // Use Stripe meter events with idempotency key when prices exist.
        // Placeholder until founder creates metered prices.
        console.log(
          JSON.stringify({ event: "usage_report_queued", data: body.data })
        );
      }

      msg.ack();
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env) {
    // Daily reconcile of D1 usageCounters vs Stripe.
    // Enqueue dunning for past_due invoices not already queued.
    console.log(JSON.stringify({ event: "billing_cron", ts: new Date().toISOString() }));
  },
};

export async function checkFreeTier(
  env: Env,
  customerId: string,
  isAI: boolean
): Promise<{ allowed: boolean; remaining: number }> {
  // D1 query against usage_counters. Implement tenant-scoped lookup.
  // Returns allowed: false after limits.
  const limit = isAI ? FREE_AI_LIFETIME : FREE_PROTOCOL_MONTHLY;
  // Placeholder query — replace with real D1 prepared statement.
  return { allowed: true, remaining: limit };
}
