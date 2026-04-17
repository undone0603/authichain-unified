/**
 * Vercel serverless function entry point.
 * All /api/* requests are routed here by vercel.json rewrites.
 * The Express app handles tRPC, OAuth, and Stripe webhooks.
 * Scheduled jobs run via Vercel Cron (see vercel.json crons section).
 */
let app: any;
try {
  const { createApp } = await import("./_core/app");
  app = createApp();
  console.log("[vercel-entry] App created successfully");
} catch (err: any) {
  console.error("[vercel-entry] FATAL: Failed to create app:", err?.message, err?.stack);
  // Return a minimal handler that reports the error
  app = (_req: any, res: any) => {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "App initialization failed", message: err?.message }));
  };
}

export default app;
