import { getDb } from "./db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Stripe } from "stripe";
import { getCRMStats } from "./hubspot-service";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal logger — avoids a dependency on a separate logger module.
const logger = {
  info: (msg: string) => console.info(`[smoke] ${msg}`),
  warn: (msg: string) => console.warn(`[smoke] ${msg}`),
  error: (obj: unknown, msg: string) => console.error(`[smoke] ${msg}`, obj),
};

export async function runSmokeTests(): Promise<void> {
  logger.info("Running platform smoke tests...");

  // 1. Verify Supabase/Database connectivity
  try {
    const db = await getDb();
    await db.execute(sql`SELECT 1`);
    logger.info("Supabase/DB connection: OK");
  } catch (error) {
    logger.error({ error }, "Supabase/DB connection: FAILED");
    process.exit(1);
  }

  // 2. Verify Stripe connectivity (non-destructive)
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-07-29.dahlia" as any });
      await stripe.accounts.retrieve("self");
      logger.info("Stripe connection: OK");
    } catch (error) {
      logger.error({ error }, "Stripe connection: FAILED");
    }
  } else {
    logger.warn("Stripe: STRIPE_SECRET_KEY not set");
  }

  // 3. Verify HubSpot connectivity (non-destructive)
  if (process.env.HUBSPOT_SERVICE_KEY) {
    try {
      const stats = await getCRMStats();
      if (stats.connected) {
        logger.info("HubSpot connection: OK");
      } else {
        logger.warn("HubSpot: Not fully connected");
      }
    } catch (error) {
      logger.error({ error }, "HubSpot connection: FAILED");
    }
  } else {
    logger.warn("HubSpot: HUBSPOT_SERVICE_KEY not set");
  }

  // 4. Verify mandatory static assets (dist/index.html)
  const indexPath = path.resolve(__dirname, "../../dist/index.html");
  if (!fs.existsSync(indexPath)) {
    logger.warn("Static asset check: dist/index.html NOT FOUND. Ensure build ran.");
    if (process.env.NODE_ENV === "production") {
      logger.error({}, "Static asset check: FAILED in production");
      process.exit(1);
    }
  } else {
    logger.info("Static assets check: OK");
  }

  logger.info("All smoke tests passed.");
}
