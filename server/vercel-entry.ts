/**
 * Vercel serverless function entry point.
 * The Express app handles tRPC, OAuth, and Stripe webhooks.
 *
 * Scheduled jobs (server/scheduled-jobs.ts, e.g. founder-payout) do NOT run
 * here. This file never calls initializeScheduler(), and vercel.json has no
 * `crons` block — that's a stale claim this comment previously made. The
 * only entrypoint that starts the scheduler is server/_core/index.ts (the
 * `node dist/index.js` process Dockerfile/railway.json build and run),
 * i.e. the standalone Railway service, not Vercel.
 */
import { createApp } from "./_core/app";

export default createApp();
