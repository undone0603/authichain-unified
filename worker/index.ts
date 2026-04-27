import { Hono } from "hono";
import { cors } from "hono/cors";
import { handle } from "hono/cloudflare-pages";

// GitHub webhook signature verification
import { createHmac } from "node:crypto";

const app = new Hono();

// CORS for browser clients
app.use("*", cors());

// Health check
app.get("/health", (c) => c.json({ ok: true, env: c.env.APP_ENV }));

// GitHub Marketplace Webhook
app.post("/webhook/github", async (c) => {
  const signature = c.req.header("X-Hub-Signature-256");
  const body = await c.req.text();

  const expected = `sha256=${createHmac("sha256", c.env.GITHUB_WEBHOOK_SECRET)
    .update(body)
    .digest("hex")}`;

  if (signature !== expected) {
    return c.json({ error: "invalid signature" }, 401);
  }

  const event = JSON.parse(body);
  const type = c.req.header("X-GitHub-Event");

  // Store event in D1
  await c.env.DB.prepare(
    `INSERT INTO marketplace_events (event_type, payload) VALUES (?, ?)`
  ).bind(type, JSON.stringify(event)).run();

  return c.json({ ok: true });
});

// Example API route
app.get("/api/user/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    "SELECT * FROM users WHERE id = ?"
  ).bind(id).first();

  return c.json(row ?? { error: "not found" });
});

// Cron monetization engine
app.get("/cron/hourly", async (c) => {
  // Example: sync subscriptions
  await c.env.DB.prepare(
    "INSERT INTO cron_logs (ts, note) VALUES (datetime('now'), 'cron ran')"
  ).run();

  return c.json({ ok: true, ran: "hourly" });
});

// Static asset fallback (Cloudflare Assets)
app.get("*", async (c) => {
  return await c.env.ASSETS.fetch(c.req.raw);
});

export default app;
export const onRequest = handle(app);
