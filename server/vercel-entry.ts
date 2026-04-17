/**
 * Vercel serverless function entry point.
 * All /api/* requests are routed here by vercel.json rewrites.
 * The Express app handles tRPC, OAuth, and Stripe webhooks.
 * Scheduled jobs run via Vercel Cron (see vercel.json crons section).
 */
import { createApp } from "./_core/app";

export default createApp();
