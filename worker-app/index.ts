import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "../server/routers";
import { createWorkersContext } from "../server/_core/context.workers";
import { resolveBrand, BRANDS, type BrandId } from "../shared/brands";
import { getHyperdriveDb } from "../server/db";
import { getScheduledJobs, executeJobWithDb } from "../server/scheduled-jobs";
import { timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { getSessionCookieOptions } from "../server/_core/cookies";
import { products, certificates } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "./rate-limiter";
import { resolveOwner } from "./route-manifest";
import { renderDynamicPage } from "./dynamic-pages";

type Env = {
  HYPERDRIVE: Hyperdrive;
  ASSETS: Fetcher;
  SESSIONS: KVNamespace;
  RATE_LIMITER: DurableObjectNamespace;
};

type Variables = {
  brand: BrandId;
};


// Shared timing-safe string comparison for webhook secret headers (mirrors
// the local helper in server/_core/app.ts and server/internal-api.ts).
function timingSafeEqualStrings(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return cryptoTimingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export const app = new Hono<{ Bindings: Env; Variables: Variables }>();
// Named export above lets tests (routes.test.ts) exercise the Hono app's
// own .request() test helper directly; the default export below is the
// { fetch, scheduled } object shape Workers actually invokes.

// Brand resolution — same logic as src/middleware.ts and the old
// server/_core/brand-middleware.ts, ported to Hono context instead of
// Express res.locals.
app.use("*", async (c, next) => {
  const host = c.req.header("x-forwarded-host") ?? c.req.header("host") ?? "";
  const brand = resolveBrand(host);
  c.set("brand", brand);
  c.header("X-Brand", brand);
  await next();
});

// ─── Rate limiting (Durable Object–backed) ─────────────────────────────────
// Replaces the Express oauthRateLimit/contactRateLimit/gptRateLimit/
// globalApiRateLimit/adminRateLimit middlewares (server/_core/rate-limit.ts)
// on the Workers path. Same exact per-route limits, backed by the
// RATE_LIMITER Durable Object instead of a process-local in-memory Map.
//
// tRPC per-procedure rate limiting (rateLimitedPublicProcedure in
// server/_core/trpc.ts, used by 2 procedures in server/sales/router.ts) is
// intentionally OUT OF SCOPE here — that middleware already no-ops on the
// Workers path (guarded in an earlier migration task). Those 2 procedures
// still fall under the global /api/* 300/min limit below (a coarser bound
// than their specific 30/min Express limit); threading the Durable Object
// into the tRPC context is a larger change left as a follow-up.
function rateLimitMiddleware(namePrefix: string, limit: number, windowMs: number) {
  return async (c: any, next: () => Promise<void>) => {
    // Fail open if the RATE_LIMITER Durable Object binding isn't present
    // (e.g. the Node-based vitest suite in routes.test.ts, which runs
    // worker-app/index.ts outside workerd with no c.env at all — see
    // vitest.config.ts's "worker-app/**/*.test.ts" include). In a real
    // deployment the binding is always present per wrangler.toml, so this
    // only matters for tests / a misconfigured environment, where skipping
    // the check is safer than 500ing every request.
    const namespace = c.env?.RATE_LIMITER;
    if (namespace) {
      const ip = c.req.header("cf-connecting-ip") ?? "unknown";
      const allowed = await checkRateLimit(namespace, `${namePrefix}:${ip}`, limit, windowMs);
      if (!allowed) {
        return c.json({ error: "Too many requests. Please slow down." }, 429);
      }
    }
    await next();
  };
}

// OAuth callback: 20 attempts per 15 min per IP
app.use("/api/oauth/*", rateLimitMiddleware("oauth", 20, 15 * 60_000));
// Contact form: 5 submissions per hour per IP
app.use("/api/contact/*", rateLimitMiddleware("contact", 5, 60 * 60_000));
// GPT plugin endpoints: 60 requests per minute per IP
app.use("/api/gpt/*", rateLimitMiddleware("gpt", 60, 60_000));
// Admin ops: 30 requests per 15 min per IP
app.use("/api/admin/*", rateLimitMiddleware("admin", 30, 15 * 60_000));
// Catch-all API guard: 300 requests per minute per IP (also covers
// /api/trpc/* — see tRPC note above)
app.use("/api/*", rateLimitMiddleware("global", 300, 60_000));

app.use(
  "/api/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (opts, c) => createWorkersContext(opts, c.env),
  })
);

app.get("/api/health", (c) => c.json({ status: "ok" }));


// ─── Stripe Webhook ─────────────────────────────────────────────────────────
// handleStripeWebhook(db, rawBody, sig) is a framework-agnostic plain
// function (server/webhooks/stripe.ts) — just a new call site here.
app.post("/api/stripe/webhook", async (c) => {
  const sig = c.req.header("stripe-signature");
  if (!sig) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }
  try {
    const { handleStripeWebhook } = await import("../server/webhooks/stripe");
    const rawBody = Buffer.from(await c.req.arrayBuffer());
    const db = getHyperdriveDb(c.env);
    const result = await handleStripeWebhook(db, rawBody, sig);
    return c.json(result);
  } catch (err: any) {
    console.error(`[Stripe Webhook] Error: ${err.message}`);
    return c.json({ error: err.message }, 400);
  }
});

// ─── Paddle Webhook ─────────────────────────────────────────────────────────
// handlePaddleWebhook(db, req, res) takes Express-shaped req/res objects
// directly (not a framework-agnostic signature like the other webhook
// handlers) — this is a minimal req/res shim rather than a rewrite of
// server/paddle/webhook.ts, which only touches req.headers, req.body, and
// res.status()/res.json().
app.post("/api/paddle/webhook", async (c) => {
  const sig = c.req.header("paddle-signature");
  if (!sig) {
    return c.json({ error: "Missing paddle-signature header" }, 400);
  }
  try {
    const { handlePaddleWebhook } = await import("../server/paddle/webhook");
    const bodyText = await c.req.text();
    const db = getHyperdriveDb(c.env);
    let statusCode = 200;
    let responseBody: unknown = null;
    const fakeReq = {
      headers: { "paddle-signature": sig },
      body: { toString: () => bodyText },
    } as any;
    const fakeRes = {
      status(code: number) { statusCode = code; return fakeRes; },
      json(body: unknown) { responseBody = body; return fakeRes; },
    } as any;
    await handlePaddleWebhook(db, fakeReq, fakeRes);
    return c.json(responseBody as any, statusCode as any);
  } catch (err: any) {
    console.error(`[Paddle Webhook] Error: ${err.message}`);
    return c.json({ error: err.message }, 400);
  }
});


// ─── Instantly.ai Webhook ───────────────────────────────────────────────────
app.post("/api/webhooks/instantly", async (c) => {
  const secret = process.env.INSTANTLY_WEBHOOK_SECRET;
  if (secret) {
    const provided = c.req.header("x-webhook-secret");
    if (!provided || !timingSafeEqualStrings(provided, secret)) {
      return c.json({ error: "Invalid webhook secret" }, 401);
    }
  }
  try {
    const { handleInstantlyWebhook } = await import("../server/webhooks/instantly");
    const payload = await c.req.json();
    const db = getHyperdriveDb(c.env);
    const result = await handleInstantlyWebhook(db, payload);
    return c.json(result);
  } catch (err: any) {
    console.error(`[Instantly Webhook] Error: ${err.message}`);
    return c.json({ error: err.message }, 500);
  }
});

// ─── DocuSign Webhook ───────────────────────────────────────────────────────
app.post("/api/webhooks/docusign", async (c) => {
  const secret = process.env.DOCUSIGN_WEBHOOK_SECRET;
  if (secret) {
    const provided = c.req.header("x-docusign-secret");
    if (!provided || !timingSafeEqualStrings(provided, secret)) {
      return c.json({ error: "Invalid webhook secret" }, 401);
    }
  }
  try {
    const { handleDocuSignWebhook } = await import("../server/webhooks/docusign");
    const payload = await c.req.json();
    const db = getHyperdriveDb(c.env);
    const result = await handleDocuSignWebhook(db, payload);
    return c.json(result);
  } catch (err: any) {
    console.error(`[DocuSign Webhook] Error: ${err.message}`);
    return c.json({ error: err.message }, 500);
  }
});


// ─── Admin ops console (client/src/pages/OpsDashboard.tsx) ─────────────────
app.get("/api/admin/ops", async (c) => {
  const { sdk } = await import("../server/_core/sdk");
  const user = await sdk.authenticateRequest(c.req.raw).catch(() => null);
  if (!user) {
    return c.json({ error: "Not signed in" }, 401);
  }
  if (user.role !== "admin") {
    return c.json({ error: "Admin only" }, 403);
  }
  try {
    const { getOpsSummary } = await import("../server/_core/db-helpers");
    const db = getHyperdriveDb(c.env);
    const summary = await getOpsSummary(db);
    return c.json(summary);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "ops query failed" }, 500);
  }
});


// ─── OAuth callback ─────────────────────────────────────────────────────────
app.get("/api/oauth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code || !state) {
    return c.json({ error: "code and state are required" }, 400);
  }

  try {
    const { sdk } = await import("../server/_core/sdk");
    const tokenResponse = await sdk.exchangeCodeForToken(code, state);
    const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

    if (!userInfo.openId) {
      return c.json({ error: "openId missing from user info" }, 400);
    }

    const { upsertUser } = await import("../server/_core/db-helpers");
    const db = getHyperdriveDb(c.env);
    await upsertUser(db, {
      openId: userInfo.openId,
      name: userInfo.name || null,
      email: userInfo.email ?? null,
      loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
      lastSignedIn: new Date(),
    });

    const sessionToken = await sdk.createSessionToken(userInfo.openId, {
      name: userInfo.name || "",
      expiresInMs: ONE_YEAR_MS,
    });

    // isSecureRequest() (server/_core/cookies.ts) takes an Express Request;
    // the Workers equivalent is context.workers.ts's own protocol check,
    // mirrored here since it isn't exported as a standalone helper.
    const url = new URL(c.req.url);
    const forwardedProto = c.req.header("x-forwarded-proto");
    const secure =
      url.protocol === "https:" ||
      (forwardedProto?.split(",").some((p) => p.trim().toLowerCase() === "https") ?? false);

    const cookieOptions = getSessionCookieOptions(secure);
    const cookieParts = [
      `${COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
      `Path=${cookieOptions.path}`,
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${Math.floor(ONE_YEAR_MS / 1000)}`,
    ];
    if (cookieOptions.secure) cookieParts.push("Secure");
    c.header("Set-Cookie", cookieParts.join("; "));

    return c.redirect("/", 302);
  } catch (error) {
    console.error("[OAuth] Callback failed", error);
    return c.json({ error: "OAuth callback failed" }, 500);
  }
});


function escapeContactHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Contact form (server/contact/index.ts's router body, ported directly —
// it's a single POST / handler with no Express-specific internals beyond
// req.body/res.json) ─────────────────────────────────────────────────────
app.post("/api/contact", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}) as any);
    const { name, email, company, message, subject } = body ?? {};

    if (!name || !email || !message) {
      return c.json({ success: false, error: "Name, email, and message are required" }, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
    if (!emailRegex.test(email)) {
      return c.json({ success: false, error: "Invalid email address" }, 400);
    }

    const safeName = escapeContactHtml(name);
    const safeEmail = escapeContactHtml(email);
    const safeCompany = escapeContactHtml(company || "N/A");
    const safeMessage = escapeContactHtml(message);
    const safeSubject = subject ? escapeContactHtml(subject) : `Contact form: ${safeName}`;

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const toEmail = process.env.CONTACT_EMAIL || "hello@authichain.com";

    if (smtpHost && smtpUser && smtpPass) {
      // nodemailer needs Node net/tls; loaded lazily so requests that never
      // hit this SMTP-configured branch don't pay the Workers nodejs_compat
      // module cost (same lazy-load rationale as server/email-service.ts).
      const nodemailer = (await import("nodemailer")).default;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: `"${safeName}" <${smtpUser}>`,
        replyTo: safeEmail,
        to: toEmail,
        subject: safeSubject,
        text: `Name: ${name}\nEmail: ${email}\nCompany: ${company || "N/A"}\nMessage:\n${message}`,
        html: `<p><strong>Name:</strong> ${safeName}</p><p><strong>Email:</strong> ${safeEmail}</p><p><strong>Company:</strong> ${safeCompany}</p><p><strong>Message:</strong></p><p>${safeMessage}</p>`,
      });
    }

    return c.json({
      success: true,
      message: "Thank you for your message. We will be in touch shortly.",
    });
  } catch (error) {
    console.error("Contact form error:", error);
    return c.json({ success: false, error: "Failed to process your request. Please try again." }, 500);
  }
});


// ─── GPT plugin REST endpoints (server/gpt/router.ts's Express Router,
// ported route-by-route — each handler only touched req.body/req.query and
// a getDb() bridge, replaced here with c.req.json()/c.req.query() and
// getHyperdriveDb(c.env)) ────────────────────────────────────────────────

// POST /api/gpt/verify - Verify product authenticity
app.post("/api/gpt/verify", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}) as any);
    const productId = body?.productId;
    if (!productId) return c.json({ error: "productId required" }, 400);
    const db = getHyperdriveDb(c.env);
    const [product] = await db.select().from(products).where(eq(products.id, Number(productId))).limit(1);
    if (!product) {
      return c.json({
        verified: false,
        trustScore: 0,
        message: "Product not found. This item may be counterfeit.",
        blockchain: null,
      });
    }
    const [cert] = await db.select().from(certificates).where(eq(certificates.productId, product.id)).limit(1);
    return c.json({
      verified: !!cert,
      trustScore: cert ? 95 : 20,
      productName: product.name,
      brand: product.brand ?? null,
      certificateId: cert?.id ?? null,
      blockchain: cert ? { status: "SECURED", network: "Polygon" } : null,
      message: cert
        ? `VERIFIED AUTHENTIC: ${product.name} - Blockchain secured.`
        : `UNVERIFIED: ${product.name} lacks blockchain certificate.`,
    });
  } catch (err) {
    console.error("[GPT /verify]", err);
    return c.json({ error: "Internal error during verification" }, 500);
  }
});

// POST /api/gpt/qr/generate - Generate a QR code
app.post("/api/gpt/qr/generate", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}) as any);
    const { productId, style, size } = body ?? {};
    if (!productId) return c.json({ error: "productId required" }, 400);
    const verifyUrl = `https://authichain.com/verify/${productId}`;
    return c.json({
      qrUrl: verifyUrl,
      embedUrl: `https://authichain.com/api/qr/${productId}?style=${style || "default"}&size=${size || 256}`,
      message: `QR code generated for product ${productId}`,
    });
  } catch (err) {
    console.error("[GPT /qr/generate]", err);
    return c.json({ error: "QR generation failed" }, 500);
  }
});

// GET /api/gpt/certificates/verify - Check certificate by number
app.get("/api/gpt/certificates/verify", async (c) => {
  try {
    const certNumber = c.req.query("certNumber");
    if (!certNumber) return c.json({ error: "certNumber required" }, 400);
    if (certNumber.length > 64) return c.json({ error: "certNumber too long" }, 400);
    const db = getHyperdriveDb(c.env);
    const [cert] = await db.select().from(certificates).where(eq(certificates.certificateNumber, certNumber)).limit(1);
    if (!cert) return c.json({ valid: false, message: "Certificate not found" });
    return c.json({
      valid: true,
      certificateId: cert.id,
      issuedAt: cert.issuedAt,
      blockchain: { status: "SECURED", network: "Polygon" },
      message: "Certificate is valid and blockchain-secured.",
    });
  } catch (err) {
    console.error("[GPT /certificates/verify]", err);
    return c.json({ error: "Certificate check failed" }, 500);
  }
});

// POST /api/gpt/cannabis/verify - Verify cannabis strain (by product name)
app.post("/api/gpt/cannabis/verify", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}) as any);
    const { strainName, batchId } = body ?? {};
    if (!batchId && !strainName) {
      return c.json({ error: "strainName or batchId required" }, 400);
    }
    const db = getHyperdriveDb(c.env);
    const [product] = strainName
      ? await db.select().from(products).where(eq(products.name, strainName)).limit(1)
      : [];
    return c.json({
      verified: !!product,
      strainName: strainName || "Unknown",
      batchId: batchId || null,
      metrcCompliant: !!product,
      blockchain: product ? { status: "SECURED", network: "Polygon" } : null,
      message: product
        ? `VERIFIED: ${product.name} - METRC compliant, blockchain secured.`
        : "Strain not found in AuthiChain registry.",
    });
  } catch (err) {
    console.error("[GPT /cannabis/verify]", err);
    return c.json({ error: "Cannabis verification failed" }, 500);
  }
});

// POST /api/gpt/trust-score - Compute trust score
app.post("/api/gpt/trust-score", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}) as any);
    const productId = body?.productId;
    if (!productId) return c.json({ error: "productId required" }, 400);
    const db = getHyperdriveDb(c.env);
    const [product] = await db.select().from(products).where(eq(products.id, Number(productId))).limit(1);
    if (!product) return c.json({ trustScore: 0, verdict: "UNKNOWN", message: "Product not found" });
    const [cert] = await db.select().from(certificates).where(eq(certificates.productId, product.id)).limit(1);
    const baseScore = cert ? 85 : 15;
    const trustScore = Math.min(100, baseScore);
    const verdict = trustScore >= 80 ? "TRUSTED" : trustScore >= 50 ? "MODERATE" : "SUSPICIOUS";
    return c.json({
      trustScore,
      verdict,
      breakdown: { blockchainCert: cert ? 85 : 0 },
      message: `Trust score for ${product.name}: ${trustScore}/100 — ${verdict}`,
    });
  } catch (err) {
    console.error("[GPT /trust-score]", err);
    return c.json({ error: "Trust score computation failed" }, 500);
  }
});

// ─── Internal API for the authichain-gateway Cloudflare Worker
// (server/internal-api.ts's Express Router, ported route-by-route).
// Protected by X-Internal-Secret header. ────────────────────────────────
app.use("/api/internal/*", async (c, next) => {
  const secret = c.req.header("x-internal-secret");
  const { ENV } = await import("../server/_core/env");
  if (!secret || !timingSafeEqualStrings(secret, ENV.internalApiSecret)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

// POST /api/internal/verify
app.post("/api/internal/verify", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}) as any);
    const { identifier, productId, barcode, imageUrl } = body ?? {};
    const lookupId = identifier || productId || barcode;
    if (!lookupId) return c.json({ error: "identifier, productId, or barcode required" }, 400);

    const db = getHyperdriveDb(c.env);
    const { getCertificateByNumber } = await import("../server/content-db-helpers");
    const cert = await getCertificateByNumber(db, lookupId);
    if (cert) {
      return c.json({
        verified: cert.status === "active",
        type: "certificate",
        certificate: cert,
        trustScore: 95,
        confidence: 0.98,
        agents: ["Guardian", "Archivist", "Sentinel", "Scout", "Arbiter"],
      });
    }

    // Prevent prompt injection — only the sanitized identifier reaches the LLM
    const safeLookupId = String(lookupId).replace(/[^a-zA-Z0-9\-_.]/g, "").slice(0, 128);

    const { invokeLLM, parseLLMContent } = await import("../server/_core/llm");
    const analysis = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are AuthiChain's product verification engine. Analyze the product identifier and determine authenticity. Return JSON: { "verified": boolean, "confidence": number (0-1), "reasoning": string, "riskFlags": string[] }`,
        },
        {
          role: "user",
          content: JSON.stringify({ identifier: safeLookupId, hasImage: !!imageUrl }),
        },
      ],
      responseFormat: { type: "json_object" },
    });

    let result: { verified: boolean; confidence: number; reasoning: string; riskFlags: string[] };
    try {
      result = parseLLMContent(analysis.choices[0].message.content);
    } catch {
      return c.json({ error: "Internal server error" }, 500);
    }
    return c.json({
      verified: result.verified,
      type: "ai_analysis",
      trustScore: Math.round(result.confidence * 100),
      confidence: result.confidence,
      reasoning: result.reasoning,
      riskFlags: result.riskFlags || [],
      agents: ["Guardian", "Archivist", "Sentinel", "Scout", "Arbiter"],
    });
  } catch (err: any) {
    console.error("[Internal API] verify error:", err.message);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/internal/qr/generate
app.post("/api/internal/qr/generate", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}) as any);
    const { url, data, style, productName, brand, productId } = body ?? {};
    const qrData = url || data;
    if (!qrData) return c.json({ error: "url or data required" }, 400);

    const { generateProductQRON } = await import("../server/qron-service");
    const result = await generateProductQRON({
      productId: productId || 0,
      productName: productName || "Product",
      brand: brand || undefined,
      tier: style === "premium" ? "premium" : "standard",
      verifyUrl: qrData,
    });

    return c.json(result);
  } catch (err: any) {
    console.error("[Internal API] qr/generate error:", err.message);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/internal/certificates/verify
app.post("/api/internal/certificates/verify", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}) as any);
    const raw = body?.certNumber ?? body?.number;
    const number = typeof raw === "string" ? raw : undefined;
    if (!number) return c.json({ error: "certNumber body field required" }, 400);
    if (number.length > 64) return c.json({ error: "certNumber too long" }, 400);

    const db = getHyperdriveDb(c.env);
    const { getCertificateByNumber } = await import("../server/content-db-helpers");
    const cert = await getCertificateByNumber(db, number);
    if (!cert) return c.json({ error: "Certificate not found", valid: false }, 404);

    return c.json({
      valid: cert.status === "active",
      certificate: cert,
      issuedAt: cert.issuedAt,
      expiresAt: cert.expiresAt,
      blockchainVerified: !!cert.blockchainTxHash,
    });
  } catch (err: any) {
    console.error("[Internal API] certificates/verify error:", err.message);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/internal/cannabis/verify
app.post("/api/internal/cannabis/verify", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}) as any);
    const { strainId, strainName, dispensaryId, batchId, thcPercent, cbdPercent } = body ?? {};
    const strain = strainName || strainId;
    if (!strain) return c.json({ error: "strainName or strainId required" }, 400);

    const metadata = {
      name: strain,
      type: "HYBRID" as const,
      genetics: ["Unknown"],
      thcContent: thcPercent || 25,
      cbdContent: cbdPercent || 1,
      harvestDate: new Date().toISOString(),
    };
    const profile = {
      thc: thcPercent || 25,
      thca: (thcPercent || 25) * 1.12,
      cbd: cbdPercent || 1,
      cbda: (cbdPercent || 1) * 1.2,
      total: (thcPercent || 25) + (cbdPercent || 1) + 5,
    };

    const { calculateStrainRarity, formatTruthLayerMetadata } = await import("../server/cannabis-service");
    const rarity = calculateStrainRarity(metadata, profile);
    const truthLayer = formatTruthLayerMetadata(metadata, profile);

    return c.json({
      verified: true,
      strainName: strain,
      batchId: batchId || null,
      dispensaryId: dispensaryId || null,
      rarityScore: rarity,
      complianceStatus: dispensaryId ? "compliant" : "unverified",
      truthLayer,
    });
  } catch (err: any) {
    console.error("[Internal API] cannabis/verify error:", err.message);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/internal/trust-score
app.post("/api/internal/trust-score", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}) as any);
    const { qrDecodePass, blockchainCertExists, nfcMatch, visualMatch, geoFenceOk } = body ?? {};

    const { computeTrustScore } = await import("../server/qron-service");
    const score = computeTrustScore({
      qrDecodePass: qrDecodePass ?? true,
      blockchainCertExists: blockchainCertExists ?? false,
      communityVerified: visualMatch ? Math.round(visualMatch / 20) : 0,
      communityFlagged: 0,
      openArtRegistered: nfcMatch ?? false,
    });

    return c.json({
      ...score,
      inputs: { qrDecodePass, blockchainCertExists, nfcMatch, visualMatch, geoFenceOk },
    });
  } catch (err: any) {
    console.error("[Internal API] trust-score error:", err.message);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/internal/analytics
app.get("/api/internal/analytics", async (c) => {
  try {
    const period = c.req.query("period") || "30d";
    // Not used for querying below (this endpoint returns static stub
    // metrics), but kept so a misconfigured Hyperdrive binding still
    // surfaces here as a 500 rather than silently returning stub data.
    getHyperdriveDb(c.env);

    return c.json({
      period,
      verifications: { total: 0, authentic: 0, counterfeit: 0 },
      qrCodesGenerated: 0,
      certificatesIssued: 0,
      activeAgents: 5,
      message: "Analytics data will be populated once usage metering is active",
    });
  } catch (err: any) {
    console.error("[Internal API] analytics error:", err.message);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/internal/products/register
app.post("/api/internal/products/register", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}) as any);
    const { name, brand, category, serialNumber, description, userId } = body ?? {};
    if (!name) return c.json({ error: "name required" }, 400);
    const parsedUserId = parseInt(userId, 10);
    if (!userId || !Number.isFinite(parsedUserId) || parsedUserId <= 0) {
      return c.json({ error: "valid userId required" }, 400);
    }

    const db = getHyperdriveDb(c.env);
    const { createProduct } = await import("../server/content-db-helpers");
    const product = await createProduct(db, {
      name,
      brand,
      category,
      serialNumber,
      description,
      userId: parsedUserId,
      status: "active",
    });

    return c.json({ success: true, product });
  } catch (err: any) {
    console.error("[Internal API] products/register error:", err.message);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/internal/usage/report
app.post("/api/internal/usage/report", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}) as any);
    const { records } = body ?? {};
    if (!Array.isArray(records) || records.length === 0) {
      return c.json({ error: "records array required" }, 400);
    }

    const usageDb = getHyperdriveDb(c.env);
    const { reportUsageToStripe } = await import("../server/tenant-billing");
    await Promise.all(
      records.map((r: { tenantId: number; endpoint: string; count: number }) =>
        reportUsageToStripe(usageDb, r.tenantId, r.endpoint, r.count),
      ),
    );

    return c.json({ success: true, processed: records.length });
  } catch (err: any) {
    console.error("[Internal API] usage/report error:", err.message);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/internal/tenant
app.get("/api/internal/tenant", async (c) => {
  try {
    const authHeader = c.req.header("authorization");
    const apiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!apiKey) return c.json({ error: "Authorization: Bearer <apiKey> required" }, 400);

    const db = getHyperdriveDb(c.env);
    const { getWhiteLabelByApiKey } = await import("../server/content-db-helpers");
    const tenant = await getWhiteLabelByApiKey(db, apiKey);
    if (!tenant) return c.json({ error: "Tenant not found" }, 404);

    return c.json({
      id: tenant.id,
      companyName: tenant.companyName,
      status: tenant.status,
      apiCallLimit: tenant.apiCallLimit,
      monthlyApiCalls: tenant.monthlyApiCalls,
      features: tenant.features,
    });
  } catch (err: any) {
    console.error("[Internal API] tenant error:", err.message);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// ─── Manifest-driven static + SPA routing (Task 3.2) ───────────────────────
// The Worker is the SINGLE routing authority (worker-first, see
// wrangler.toml [assets].run_worker_first). resolveOwner() in route-manifest.ts
// decides the owner of every non-asset navigation request, OVERRIDING what a
// naive static-asset layer would do (e.g. dist/site/admin.html exists because
// Next prerendered /admin, but D1 says /admin -> SPA shell; pricing.html exists
// and D1 says /pricing -> marketing). Static asset dirs (/_next/*, /assets/*)
// are served directly by the Asset Worker and never reach here.

// Cached marketing route set, loaded once from the merged assets dir via the
// ASSETS binding. Module-level cache so we fetch+parse the manifest a single
// time per isolate. Fail-open to an empty set so a missing manifest (or the
// Node vitest suite with a partial env) never 500s — an empty set just means
// resolveOwner treats every unknown path as "spa-fallback".
let _marketingRoutesCache: Promise<Set<string>> | null = null;

async function getMarketingRoutes(env: Env): Promise<Set<string>> {
  if (_marketingRoutesCache) return _marketingRoutesCache;
  _marketingRoutesCache = (async () => {
    try {
      const res = await env.ASSETS.fetch(
        new Request("https://internal/marketing-manifest.json"),
      );
      if (!res || res.status !== 200) return new Set<string>();
      const data = (await res.json()) as { routes?: string[] };
      return new Set<string>(Array.isArray(data.routes) ? data.routes : []);
    } catch {
      return new Set<string>();
    }
  })();
  return _marketingRoutesCache;
}

// Test-only: reset the module-level manifest cache between cases so a fresh
// mock env is re-read (see routes.test.ts).
export function __resetMarketingRoutesCache(): void {
  _marketingRoutesCache = null;
}

// Serve the Vite/wouter SPA shell (index.html). wouter resolves the route
// client-side (or renders its own 404).
async function serveSpaShell(c: any): Promise<Response> {
  const res = await c.env.ASSETS.fetch(
    new Request(new URL("/index.html", c.req.url), c.req.raw),
  );
  // Inject per-brand SEO/meta into the otherwise brand-agnostic SPA shell so
  // crawlers and social unfurlers see the correct title/description/OG image
  // per domain, and the SPA reads window.__BRAND__ (no hostname flash). The
  // page BODY is still client-rendered (D2: "SPA picks brand").
  const brand = BRANDS[c.get("brand") as BrandId];
  if (!brand || !res.ok) return res;
  const html = await res.text();
  const path = new URL(c.req.url).pathname;
  const origin = `https://${brand.domain}`;
  const title = `${brand.displayName} — ${brand.tagline}`;
  const desc = brand.description;
  const ogImage = `${origin}/apple-touch-icon-${brand.id}.png`;
  const canonical = `${origin}${path}`;
  const meta =
    `<meta property="og:title" content="${escapeContactHtml(title)}" />` +
    `<meta property="og:description" content="${escapeContactHtml(desc)}" />` +
    `<meta property="og:image" content="${ogImage}" />` +
    `<meta property="og:url" content="${canonical}" />` +
    `<meta property="og:type" content="website" />` +
    `<meta name="twitter:card" content="summary_large_image" />` +
    `<link rel="canonical" href="${canonical}" />` +
    `<script>window.__BRAND__=${JSON.stringify(brand.id)}</script>`;
  const out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeContactHtml(title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/, `<meta name="description" content="${escapeContactHtml(desc)}" />`)
    .replace("</head>", `${meta}</head>`);
  return c.html(out, res.status);
}

// Root-level static files the SPA ships alongside index.html (favicons,
// touch icons, robots.txt, sitemap.xml, web manifests, hashed/immutable
// assets, etc.) — these must be raw-fetched from ASSETS instead of getting
// the SPA shell. Deliberately an ALLOWLIST (not a bare "has a dot"
// heuristic): a naive dot-check also matches "*.html" paths like
// /admin.html, which would raw-serve the real prerendered admin.html and
// defeat the CRITICAL D1 invariant that /admin (and its .html twin) must
// always be the SPA shell. Extensions are matched case-insensitively
// against the final path segment.
const STATIC_ASSET_EXTENSIONS = new Set([
  "svg", "png", "jpg", "jpeg", "gif", "webp", "ico",
  "txt", "xml", "json", "webmanifest",
  "woff", "woff2", "ttf", "otf", "eot",
  "css", "js", "map",
  "mp4", "webm", "avif",
]);

// Per-brand robots.txt / sitemap.xml. These override the single brand-agnostic
// files the SPA ships (otherwise served raw via the extension allowlist), so
// each domain advertises its OWN sitemap and canonical origin.
app.get("/robots.txt", (c) => {
  const brand = BRANDS[c.get("brand") as BrandId];
  const body = `User-agent: *\nAllow: /\nSitemap: https://${brand.domain}/sitemap.xml\n`;
  return c.body(body, 200, { "Content-Type": "text/plain; charset=utf-8" });
});

app.get("/sitemap.xml", async (c) => {
  const brand = BRANDS[c.get("brand") as BrandId];
  const origin = `https://${brand.domain}`;
  const routes = await getMarketingRoutes(c.env);
  const paths = ["/", ...[...routes].filter((r) => r !== "/" && !r.startsWith("/_"))].sort();
  const urls = paths.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join("\n");
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return c.body(body, 200, { "Content-Type": "application/xml; charset=utf-8" });
});

app.get("*", async (c) => {
  const { pathname: rawPathname } = new URL(c.req.url);
  // Normalize a trailing slash (except root "/") so /about/ resolves the same
  // as /about; otherwise the exact-match marketing lookup misses and the page
  // wrongly falls through to the SPA shell (an SEO regression for any
  // trailing-slash inbound link or crawler).
  const pathname =
    rawPathname !== "/" && rawPathname.endsWith("/")
      ? rawPathname.replace(/\/+$/, "")
      : rawPathname;

  // Static asset dirs: raw passthrough — the file path IS the URL path.
  // (Normally served directly by the Asset Worker; this is a safety net if a
  // /_next/* request is ever routed worker-first.)
  if (pathname.startsWith("/_next/")) {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  const owner = resolveOwner(pathname, await getMarketingRoutes(c.env));

  // "api" should never reach here (real /api/* routes are registered above);
  // handle defensively by passing the raw request through to ASSETS.
  if (owner === "api") {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  // "dynamic": lean Hono-rendered pages (Task 3.3). /s, /p, /verify are real
  // handlers; /status, /grants, /gallery, /reveal, /brand/qron/artwork are
  // stubbed to the SPA shell inside renderDynamicPage itself.
  if (owner === "dynamic") {
    return renderDynamicPage(c);
  }

  // "marketing": serve the Next-prerendered static HTML for this route.
  if (owner === "marketing") {
    const base = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
    const htmlUrl = new URL(base + ".html", c.req.url);
    const res = await c.env.ASSETS.fetch(new Request(htmlUrl, c.req.raw));
    if (res.status === 200) return res;
    // marketing-miss -> fall through to the SPA shell below.
  }

  // "spa" | "spa-fallback" | marketing-miss:
  // For spa-fallback, an unknown path whose last segment has a KNOWN STATIC
  // extension (STATIC_ASSET_EXTENSIONS, e.g. /favicon-qron.svg, /robots.txt)
  // is passed through raw so root-level static assets are served correctly.
  // ".html" is deliberately NOT in that allowlist -- e.g. /admin.html must
  // still fall through to the SPA shell below, not raw-serve the real
  // prerendered admin.html (see STATIC_ASSET_EXTENSIONS comment above).
  // Everything else (real SPA routes, unknown navigation) gets the shell.
  if (owner === "spa-fallback") {
    const lastSeg = pathname.split("/").pop() ?? "";
    const dotIdx = lastSeg.lastIndexOf(".");
    const ext = dotIdx >= 0 ? lastSeg.slice(dotIdx + 1).toLowerCase() : "";
    if (STATIC_ASSET_EXTENSIONS.has(ext)) {
      const assetRes = await c.env.ASSETS.fetch(c.req.raw);
      if (assetRes.status === 200) return assetRes;
    }
  }

  return serveSpaShell(c);
});

export { RateLimiter } from "./rate-limiter";

// ─── Cron Trigger dispatcher ────────────────────────────────────────────────
// Dispatches a firing Cron Trigger to any registered scheduled-jobs.ts job(s)
// whose `schedule` matches the cron expression that fired. NOTE: the actual
// [triggers] crons in wrangler.toml are left commented out (see wrangler.toml)
// — this handler is wired and ready, but nothing currently fires it in a
// deployed Worker. Enabling specific crons is a deliberate cutover decision.
async function scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  const db = getHyperdriveDb(env);
  const due = getScheduledJobs().filter((j) => j.schedule === event.cron);
  for (const job of due) {
    // force:true — the Cron Trigger firing IS the schedule; skip the
    // node-cron-era minIntervalMs dedup (Workers cron already controls cadence).
    ctx.waitUntil(executeJobWithDb(job, db, { force: true }));
  }
}

export default { fetch: app.fetch, scheduled };
