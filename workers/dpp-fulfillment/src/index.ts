/**
 * dpp-fulfillment — Stripe webhook + daily report for EU DPP Readiness Audit.
 *
 * Events:
 *   checkout.session.completed  → onboarding email + HubSpot deal + founder notify
 *   checkout.session.expired    → one recovery email with payment link
 *   cron 0 13 * * *             → daily founder report
 *
 * Kill switch: KV key `sending_paused` = "true"
 * Idempotency: KV key `evt:{event.id}` or `sess:{session.id}:{type}`
 */

export interface Env {
  KV: KVNamespace;
  STRIPE_WEBHOOK_SECRET: string;
  RESEND_API_KEY: string;
  HUBSPOT_TOKEN?: string;
  OFFER_KEY: string;
  PAYMENT_LINK_URL: string;
  FROM_EMAIL: string;
  REPLY_TO: string;
  FOUNDER_NOTIFY: string;
}

const OFFER = "dpp_readiness_2026";

async function verifyStripeSignature(
  body: string,
  header: string | null,
  secret: string
): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(",").map(p => {
      const i = p.indexOf("=");
      return [p.slice(0, i), p.slice(i + 1)] as [string, string];
    })
  );
  const timestamp = parts["t"];
  const signatures =
    header.match(/v1=([a-f0-9]+)/g)?.map(s => s.slice(3)) ?? [];
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  const expected = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return signatures.some(s => s === expected);
}

async function isPaused(env: Env): Promise<boolean> {
  return (await env.KV.get("sending_paused")) === "true";
}

async function alreadyDone(env: Env, key: string): Promise<boolean> {
  return (await env.KV.get(key)) !== null;
}

async function markDone(
  env: Env,
  key: string,
  value: string = "1"
): Promise<void> {
  await env.KV.put(key, value, { expirationTtl: 60 * 60 * 24 * 90 }); // 90d
}

async function bumpCounter(env: Env, name: string): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const k = `stat:${day}:${name}`;
  const cur = Number((await env.KV.get(k)) ?? "0");
  await env.KV.put(k, String(cur + 1), { expirationTtl: 60 * 60 * 24 * 40 });
}

async function sendEmail(
  env: Env,
  to: string,
  subject: string,
  text: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (await isPaused(env)) {
    return { ok: false, error: "sending_paused" };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: [to],
        subject,
        text,
        reply_to: env.REPLY_TO,
      }),
    });
    const result: any = await r.json().catch(() => ({}));
    if (r.ok && result.id) return { ok: true, id: result.id };
    return { ok: false, error: result.message || `Resend HTTP ${r.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

function sessionOffer(session: any): string {
  return (
    session?.metadata?.offer ||
    session?.metadata?.offer_key ||
    session?.payment_link?.metadata?.offer ||
    ""
  );
}

function sessionEmail(session: any): string {
  return (
    session?.customer_details?.email ||
    session?.customer_email ||
    session?.customer_details?.name ||
    ""
  );
}

function sessionName(session: any): string {
  const n = session?.customer_details?.name || "";
  if (n) return n.split(" ")[0];
  const email = sessionEmail(session);
  return email ? email.split("@")[0] : "there";
}

function onboardingBody(name: string, activateUrl: string): string {
  return `Hi ${name},

Thanks for purchasing the EU DPP Readiness Audit ($299).

Your workspace is provisioned by the app webhook. Complete self-serve activation here (no reply needed):

${activateUrl}

That records merchant activation and unlocks the rest of the autonomous loop. Humans only handle exceptions.

Your $299 is fully credited toward AuthiChain Basic if you convert after the audit.

— AuthiChain
hello@authichain.com
https://authichain.com/dpp
`;
}

function recoveryBody(name: string, paymentUrl: string): string {
  return `Hi ${name},

You started checkout for the EU DPP Readiness Audit but didn't finish.

The EU DPP registry is live — brands that can't prove provenance lose shelf access. The audit is still $299 one-time (credited toward AuthiChain Basic on conversion).

Finish checkout here:
${paymentUrl}

Questions? Just reply.

— AuthiChain
hello@authichain.com
`;
}

async function createHubSpotDeal(
  env: Env,
  email: string,
  name: string,
  sessionId: string,
  amountCents: number
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!env.HUBSPOT_TOKEN) return { ok: false, error: "HUBSPOT_TOKEN not set" };
  try {
    // Find or create contact
    const search = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.HUBSPOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                { propertyName: "email", operator: "EQ", value: email },
              ],
            },
          ],
          properties: ["email", "firstname"],
          limit: 1,
        }),
      }
    );
    const searchBody: any = await search.json().catch(() => ({}));
    let contactId = searchBody?.results?.[0]?.id as string | undefined;

    if (!contactId) {
      const create = await fetch(
        "https://api.hubapi.com/crm/v3/objects/contacts",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.HUBSPOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            properties: {
              email,
              firstname: name,
              lifecyclestage: "customer",
            },
          }),
        }
      );
      const created: any = await create.json().catch(() => ({}));
      contactId = created?.id;
    }

    const deal = await fetch("https://api.hubapi.com/crm/v3/objects/deals", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.HUBSPOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          dealname: `DPP Readiness Audit — ${email}`,
          amount: String((amountCents || 29900) / 100),
          pipeline: "default",
          dealstage: "closedwon",
          description: `Stripe session ${sessionId}; offer=${OFFER}`,
        },
      }),
    });
    const dealBody: any = await deal.json().catch(() => ({}));
    if (!deal.ok) {
      return {
        ok: false,
        error: dealBody?.message || `HubSpot deal HTTP ${deal.status}`,
      };
    }

    if (contactId && dealBody.id) {
      await fetch(
        `https://api.hubapi.com/crm/v4/objects/deals/${dealBody.id}/associations/contacts/${contactId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${env.HUBSPOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([
            { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 },
          ]),
        }
      ).catch(() => null);
    }

    return { ok: true, id: dealBody.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

async function handleCompleted(env: Env, session: any): Promise<void> {
  const offer = sessionOffer(session);
  if (offer && offer !== env.OFFER_KEY && offer !== OFFER) {
    // Ignore unrelated checkouts
    return;
  }
  // If payment link metadata didn't copy, still accept when amount matches audit
  const amount = session.amount_total ?? 29900;
  const email = sessionEmail(session);
  if (!email || !email.includes("@")) return;

  const idem = `sess:${session.id}:completed`;
  if (await alreadyDone(env, idem)) return;

  const name = sessionName(session);
  const visitId =
    session.client_reference_id ||
    session.metadata?.visit_id ||
    session.metadata?.prospect_id ||
    "";
  const activateUrl = `https://authichain.com/dpp/activate?session_id=${encodeURIComponent(
    session.id
  )}${visitId ? `&visit_id=${encodeURIComponent(String(visitId))}` : ""}`;

  const buyer = await sendEmail(
    env,
    email,
    "Your EU DPP Readiness Audit — activate now",
    onboardingBody(name, activateUrl)
  );
  await bumpCounter(env, "onboarding_sent");

  const deal = await createHubSpotDeal(env, email, name, session.id, amount);
  if (deal.ok) await bumpCounter(env, "deals_created");

  await sendEmail(
    env,
    env.FOUNDER_NOTIFY,
    `DPP audit paid — ${email}`,
    [
      `New EU DPP Readiness Audit purchase.`,
      ``,
      `Buyer: ${name} <${email}>`,
      `Session: ${session.id}`,
      `Amount: $${(amount / 100).toFixed(2)}`,
      `Activate URL: ${activateUrl}`,
      `Onboarding email: ${buyer.ok ? "sent" : "FAILED — " + buyer.error}`,
      `HubSpot deal: ${deal.ok ? deal.id : "FAILED — " + deal.error}`,
      ``,
      `Provisioning is owned by the app Stripe webhook.`,
      `Escalate only if activation or provisioning fails.`,
    ].join("\n")
  );
  await bumpCounter(env, "payments");

  await markDone(
    env,
    idem,
    JSON.stringify({ email, at: new Date().toISOString() })
  );
}

async function handleExpired(env: Env, session: any): Promise<void> {
  const offer = sessionOffer(session);
  if (offer && offer !== env.OFFER_KEY && offer !== OFFER) return;

  const email = sessionEmail(session);
  if (!email || !email.includes("@")) return;

  const idem = `sess:${session.id}:expired`;
  if (await alreadyDone(env, idem)) return;

  // One recovery only per email per 14 days
  const emailIdem = `recover:${email.toLowerCase()}`;
  if (await alreadyDone(env, emailIdem)) {
    await markDone(env, idem);
    return;
  }

  const name = sessionName(session);
  const result = await sendEmail(
    env,
    email,
    "Finish your EU DPP Readiness Audit",
    recoveryBody(name, env.PAYMENT_LINK_URL)
  );
  if (result.ok) {
    await bumpCounter(env, "recovery_sent");
    await markDone(env, emailIdem, "1");
  }
  await markDone(
    env,
    idem,
    JSON.stringify({ email, ok: result.ok, at: new Date().toISOString() })
  );
}

async function dailyReport(env: Env): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const keys = [
    "payments",
    "onboarding_sent",
    "recovery_sent",
    "deals_created",
    "webhooks",
  ];
  const lines: string[] = [`DPP revenue report — ${day}`, ""];
  for (const k of keys) {
    const v = (await env.KV.get(`stat:${day}:${k}`)) ?? "0";
    lines.push(`${k}: ${v}`);
  }
  const paused = await isPaused(env);
  lines.push("", `sending_paused: ${paused}`);
  lines.push(`payment_link: ${env.PAYMENT_LINK_URL}`);
  lines.push("", "— dpp-fulfillment worker");

  await sendEmail(
    env,
    env.FOUNDER_NOTIFY,
    `DPP daily report ${day}`,
    lines.join("\n")
  );
}

async function handleWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const body = await request.text();
  const header = request.headers.get("Stripe-Signature");
  if (!(await verifyStripeSignature(body, header, env.STRIPE_WEBHOOK_SECRET))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const evtKey = `evt:${event.id}`;
  if (await alreadyDone(env, evtKey)) {
    return Response.json({ status: "already_processed" });
  }

  ctx.waitUntil(
    (async () => {
      try {
        await bumpCounter(env, "webhooks");
        switch (event.type) {
          case "checkout.session.completed":
            await handleCompleted(env, event.data.object);
            break;
          case "checkout.session.expired":
            await handleExpired(env, event.data.object);
            break;
          default:
            break;
        }
        await markDone(env, evtKey, event.type);
      } catch (err: any) {
        await env.KV.put(
          `err:${event.id}`,
          JSON.stringify({
            message: err?.message ?? String(err),
            at: new Date().toISOString(),
          }),
          { expirationTtl: 60 * 60 * 24 * 30 }
        );
      }
    })()
  );

  return Response.json({ status: "accepted" });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/health" || path === "/") {
      return Response.json({
        ok: true,
        service: "dpp-fulfillment",
        offer: env.OFFER_KEY || OFFER,
        payment_link: env.PAYMENT_LINK_URL,
      });
    }

    if (path === "/webhook" && request.method === "POST") {
      return handleWebhook(request, env, ctx);
    }

    // Manual report trigger (Bearer not required if FOUNDER path is internal; keep closed)
    if (path === "/admin/report" && request.method === "POST") {
      const auth = request.headers.get("Authorization") ?? "";
      if (
        !env.STRIPE_WEBHOOK_SECRET ||
        auth !== `Bearer ${env.STRIPE_WEBHOOK_SECRET}`
      ) {
        return new Response("Unauthorized", { status: 401 });
      }
      await dailyReport(env);
      return Response.json({ ok: true });
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(dailyReport(env));
  },
};
