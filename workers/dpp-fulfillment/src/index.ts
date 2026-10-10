/**
 * dpp-fulfillment — Stripe webhook + daily report for the EU DPP Readiness checkout ($299).
 * Not an audit. Price id is unchanged.
 */

export interface Env {
  KV: KVNamespace;
  STRIPE_WEBHOOK_SECRET: string;
  /** Bearer token for POST /admin/report. Separate from the webhook secret; unset = endpoint refuses (401). */
  DPP_ADMIN_TOKEN?: string;
  RESEND_API_KEY: string;
  HUBSPOT_TOKEN?: string;
  OFFER_KEY: string;
  PAYMENT_LINK_URL: string;
  FROM_EMAIL: string;
  REPLY_TO: string;
  FOUNDER_NOTIFY: string;
}

const OFFER = "dpp_readiness_2026";
const PRODUCT_NAME = "EU DPP Readiness";

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
  for (const candidate of signatures) {
    if (await timingSafeEqual(candidate, expected)) return true;
  }
  return false;
}

/**
 * Constant-time string compare. Both sides are SHA-256 hashed first so the
 * loop always runs over 32 bytes and length differences don't leak timing.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/**
 * Auth for POST /admin/report. Uses DPP_ADMIN_TOKEN only (never the Stripe
 * webhook secret). Fails closed: unset/empty token rejects every request.
 */
export async function isAdminAuthorized(
  authorization: string | null,
  adminToken: string | undefined
): Promise<boolean> {
  if (!adminToken) return false;
  const header = authorization ?? "";
  if (!header.startsWith("Bearer ")) return false;
  return timingSafeEqual(header.slice("Bearer ".length), adminToken);
}

async function isPaused(env: Env): Promise<boolean> {
  return (await env.KV.get("sending_paused")) === "true";
}
async function alreadyDone(env: Env, key: string): Promise<boolean> {
  return (await env.KV.get(key)) !== null;
}
async function markDone(env: Env, key: string, value = "1"): Promise<void> {
  await env.KV.put(key, value, { expirationTtl: 60 * 60 * 24 * 90 });
}
async function releaseDone(env: Env, key: string): Promise<void> {
  await env.KV.delete(key);
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
  if (await isPaused(env)) return { ok: false, error: "sending_paused" };
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
function isOtherPlan(session: any): boolean {
  const plan = String(session?.metadata?.plan || "");
  return plan !== "" && plan !== "dpp_readiness";
}
function sessionEmail(session: any): string {
  return session?.customer_details?.email || session?.customer_email || "";
}
function sessionName(session: any): string {
  const n = session?.customer_details?.name || "";
  if (n) return n.split(" ")[0];
  const email = sessionEmail(session);
  return email ? email.split("@")[0] : "there";
}
function onboardingBody(name: string, activateUrl: string): string {
  return `Hi ${name},\n\nThanks for opening an ${PRODUCT_NAME}. This is a workspace with 50 generations. It is not an audit, not a certification, and not legal advice.\n\nComplete activation here:\n${activateUrl}\n\n— AuthiChain\nhello@authichain.com\n`;
}
function recoveryBody(name: string, paymentUrl: string): string {
  return `Hi ${name},\n\nYou started checkout for the ${PRODUCT_NAME} but did not finish. It is still $299 and it is not an audit.\n\nFinish checkout here:\n${paymentUrl}\n\n— AuthiChain\nhello@authichain.com\n`;
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
          properties: ["email"],
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
            properties: { email, firstname: name, lifecyclestage: "customer" },
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
          dealname: `${PRODUCT_NAME} — ${email}`,
          amount: String((amountCents || 29900) / 100),
          pipeline: "default",
          dealstage: "closedwon",
          description: `Stripe session ${sessionId}; offer=${OFFER}`,
        },
      }),
    });
    const dealBody: any = await deal.json().catch(() => ({}));
    if (!deal.ok)
      return {
        ok: false,
        error: dealBody?.message || `HubSpot deal HTTP ${deal.status}`,
      };
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
  if (offer && offer !== env.OFFER_KEY && offer !== OFFER) return;
  if (isOtherPlan(session)) return;
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
  const activateUrl = `https://authichain.com/dpp/activate?session_id=${encodeURIComponent(session.id)}${visitId ? `&visit_id=${encodeURIComponent(String(visitId))}` : ""}`;
  const buyer = await sendEmail(
    env,
    email,
    `Your ${PRODUCT_NAME} — activate now`,
    onboardingBody(name, activateUrl)
  );
  await bumpCounter(env, "onboarding_sent");
  const deal = await createHubSpotDeal(env, email, name, session.id, amount);
  if (deal.ok) await bumpCounter(env, "deals_created");
  await sendEmail(
    env,
    env.FOUNDER_NOTIFY,
    `DPP workspace paid — ${email}`,
    [
      `New ${PRODUCT_NAME} purchase. Not an audit.`,
      `Buyer: ${name} <${email}>`,
      `Session: ${session.id}`,
      `Amount: $${(amount / 100).toFixed(2)}`,
      `Activate URL: ${activateUrl}`,
      `Onboarding email: ${buyer.ok ? "sent" : "FAILED — " + buyer.error}`,
      `HubSpot deal: ${deal.ok ? deal.id : "FAILED — " + deal.error}`,
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
  const recoveryUrl =
    typeof session?.after_expiration?.recovery?.url === "string"
      ? session.after_expiration.recovery.url
      : "";
  const offer = sessionOffer(session);
  if (offer && offer !== env.OFFER_KEY && offer !== OFFER) return;
  if (isOtherPlan(session)) return;
  const email = sessionEmail(session);
  if (!email || !email.includes("@")) return;
  const idem = `sess:${session.id}:expired`;
  if (await alreadyDone(env, idem)) return;
  const emailIdem = `recover:${email.toLowerCase()}`;
  if (await alreadyDone(env, emailIdem)) {
    await markDone(env, idem);
    return;
  }
  const result = await sendEmail(
    env,
    email,
    `Finish your ${PRODUCT_NAME}`,
    recoveryBody(sessionName(session), recoveryUrl || env.PAYMENT_LINK_URL)
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
  const lines = [`DPP workspace report — ${day}`, ""];
  for (const k of keys)
    lines.push(`${k}: ${(await env.KV.get(`stat:${day}:${k}`)) ?? "0"}`);
  lines.push(
    "",
    `sending_paused: ${await isPaused(env)}`,
    `payment_link: ${env.PAYMENT_LINK_URL}`
  );
  await sendEmail(
    env,
    env.FOUNDER_NOTIFY,
    `DPP daily report ${day}`,
    lines.join("\n")
  );
}
async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  if (
    !(await verifyStripeSignature(
      body,
      request.headers.get("Stripe-Signature"),
      env.STRIPE_WEBHOOK_SECRET
    ))
  ) {
    return new Response("Unauthorized", { status: 401 });
  }
  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const evtKey = `evt:${event.id}`;
  // Claim before any side effect. A second delivery of the same event id
  // is acknowledged and skipped. The claim is released only if the handler
  // throws before finishing, so Stripe's retry (we answer 500) can run.
  if (await alreadyDone(env, evtKey))
    return Response.json({ status: "already_processed" });
  await markDone(env, evtKey, event.type);
  try {
    await bumpCounter(env, "webhooks");
    if (event.type === "checkout.session.completed")
      await handleCompleted(env, event.data.object);
    if (event.type === "checkout.session.expired")
      await handleExpired(env, event.data.object);
    return Response.json({ status: "accepted" });
  } catch (err: any) {
    await releaseDone(env, evtKey);
    await env.KV.put(
      `err:${event.id}`,
      JSON.stringify({
        message: err?.message ?? String(err),
        at: new Date().toISOString(),
      }),
      { expirationTtl: 60 * 60 * 24 * 30 }
    );
    return new Response("Fulfillment failed", { status: 500 });
  }
}
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/health" || path === "/")
      return Response.json({
        ok: true,
        service: "dpp-fulfillment",
        offer: env.OFFER_KEY || OFFER,
      });
    if (path === "/webhook" && request.method === "POST")
      return handleWebhook(request, env);
    if (path === "/admin/report" && request.method === "POST") {
      if (
        !(await isAdminAuthorized(
          request.headers.get("Authorization"),
          env.DPP_ADMIN_TOKEN
        ))
      )
        return new Response("Unauthorized", { status: 401 });
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
