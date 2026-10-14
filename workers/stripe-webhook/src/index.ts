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
  NTFY_TOPIC?: string;
}

// ... existing helper functions remain unchanged (supabaseUpsert, etc.) ...

async function sendApprovedEmail(env: Env, email: string, template: "t1h" | "t24h" | "t72h") {
  // Placeholder: wire to existing sendEmail path with approved HTML templates
  const subjects = {
    t1h: "Your QRON Starter Pack ($29) is ready",
    t24h: "Still want the 100 Living QR generations?",
    t72h: "Last note on your QRON Starter Pack"
  };
  const buttons = {
    t1h: "Finish checkout — $29",
    t24h: "Get the Starter Pack",
    t72h: "Complete your $29 order"
  };
  console.log(JSON.stringify({ evt: "recovery_email", template, email_hash: await sha256Hex(email), subject: subjects[template], button: buttons[template] }));
  // Actual send call goes here once email binding is confirmed
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // ... existing webhook handling unchanged ...
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const now = Math.floor(Date.now() / 1000);
    const sessions = await stripe.checkout.sessions.list({
      status: "open",
      created: { gte: now - 259200, lte: now - 3600 },
      limit: 100
    });

    const abandoned = sessions.data.filter(s =>
      (s.amount_total ?? 0) >= 2900 &&
      s.customer_details?.email &&
      !isFounderEmail(s.customer_details.email)
    );

    for (const session of abandoned) {
      const ageHours = (now - session.created) / 3600;
      const email = session.customer_details!.email!;
      // In production: check alreadySent via D1/KV; here log only
      if (ageHours >= 1 && ageHours < 24) {
        await sendApprovedEmail(env, email, "t1h");
      } else if (ageHours >= 24 && ageHours < 72) {
        await sendApprovedEmail(env, email, "t24h");
      } else if (ageHours >= 72) {
        await sendApprovedEmail(env, email, "t72h");
      }
    }
  }
};
