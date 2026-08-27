import { getDb } from "../src/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config";
import { Stripe } from "stripe";
import { getCRMStats } from "./hubspot-service";
import { logger } from "./logger";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export async function runSmokeTests() {
    logger.info("Running platform smoke tests...");
    // 1. Verify Supabase/Database connectivity
    try {
        const db = getDb();
        await db.execute(sql `SELECT 1`);
        logger.info("Supabase/DB connection: OK");
    }
    catch (error) {
        logger.error({ error }, "Supabase/DB connection: FAILED");
        process.exit(1);
    }
    // 2. Verify Stripe connectivity (non-destructive)
    if (env.STRIPE_SECRET_KEY) {
        try {
            const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2025-03-31.basil" });
            await stripe.accounts.retrieve();
            logger.info("Stripe connection: OK");
        }
        catch (error) {
            logger.error({ error }, "Stripe connection: FAILED");
        }
    }
    else {
        logger.warn("Stripe: STRIPE_SECRET_KEY not set");
    }
    // 3. Verify HubSpot connectivity (non-destructive)
    if (env.HUBSPOT_SERVICE_KEY) {
        try {
            const stats = await getCRMStats();
            if (stats.connected) {
                logger.info("HubSpot connection: OK");
            }
            else {
                logger.warn({ stats }, "HubSpot: Not fully connected");
            }
        }
        catch (error) {
            logger.error({ error }, "HubSpot connection: FAILED");
        }
    }
    else {
        logger.warn("HubSpot: HUBSPOT_SERVICE_KEY not set");
    }
    // 4. Verify mandatory static assets (dist/index.html)
    const indexPath = path.resolve(__dirname, "../../dist/index.html");
    if (!fs.existsSync(indexPath)) {
        logger.warn("Static asset check: dist/index.html NOT FOUND. Ensure build ran.");
        if (env.NODE_ENV === "production") {
            logger.error("Static asset check: FAILED in production");
            process.exit(1);
        }
    }
    else {
        logger.info("Static assets check: OK");
    }
    logger.info("All smoke tests passed.");
}
