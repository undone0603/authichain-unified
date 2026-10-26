import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

app.post('/api/lead-capture', async (c) => {
  const body = await c.req.json<{
    tool: string;
    event: string;
    email?: string;
    sku?: string;
  }>();

  if (!body.tool || !['dpp-check', 'generate', 'verify', 'battery-passport'].includes(body.tool)) {
    return c.json({ error: 'invalid tool' }, 400);
  }

  const allowedEvents = ['tool_view', 'tool_complete', 'email_capture', 'cta_click_launch', 'cta_click_starter'];
  if (!allowedEvents.includes(body.event)) {
    return c.json({ error: 'invalid event' }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO tool_events (tool, event, email, sku_target, created_at)
     VALUES (?, ?, ?, ?, unixepoch())`
  )
    .bind(
      body.tool,
      body.event,
      body.email || null,
      body.sku || 'qron_launch_mo',
    )
    .run();

  return c.json({ ok: true });
});

export default app;
