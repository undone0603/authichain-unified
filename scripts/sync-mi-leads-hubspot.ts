import "dotenv/config";
import fs from "fs";
import path from "path";
import { syncLeadToHubSpot, isHubSpotConfigured } from "../server/hubspot-service";
import { ENV } from "../server/_core/env";

/**
 * HubSpot CRM Sync Script - Michigan Cannabis leads
 * 
 * Takes the extracted leads from mi_cannabis_leads.csv and pushes them 
 * to HubSpot for tracking and automated follow-ups.
 */

// Force ENV values from .env file for the sync
const envPath = path.join(process.cwd(), "authichain-unified", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [key, ...valueParts] = trimmed.split("=");
    if (key && valueParts.length > 0) {
      const k = key.trim();
      const v = valueParts.join("=").trim();
      process.env[k] = v;
      if (k === "HUBSPOT_SERVICE_KEY") (ENV as any).hubspotServiceKey = v;
    }
  });
}

const CSV_FILE = path.join(process.cwd(), "authichain-unified", "scripts", "mi_cannabis_leads.csv");

async function runSync() {
  console.log("🟠 Starting HubSpot CRM Lead Sync...");

  if (!isHubSpotConfigured()) {
    console.error("❌ HubSpot not configured. Check HUBSPOT_SERVICE_KEY in .env");
    return;
  }

  if (!fs.existsSync(CSV_FILE)) {
    console.error(`❌ CSV file not found at: ${CSV_FILE}`);
    return;
  }

  const content = fs.readFileSync(CSV_FILE, "utf-8");
  const lines = content.split("\n").slice(1); // Skip header

  let syncedCount = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // email,first_name,company,dba,city,type,tax_vulnerability
    const [email, first_name, company, dba, city, type, tax_vulnerability] = line.split(",");

    console.log(`📡 Syncing ${email} (${dba})...`);
    
    try {
      const result = await syncLeadToHubSpot({
        email: email.trim(),
        name: first_name === "Operations Director" ? `${dba} Operations` : first_name,
        company: company.trim(),
      });

      if (result && result.success) {
        syncedCount++;
        console.log(`✅ Synced: ${email}`);
      } else {
        console.error(`✗ Failed: ${email} - ${result?.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      console.error(`✗ Error syncing ${email}: ${e.message}`);
    }
  }

  console.log(`\n✨ HubSpot Sync Complete. Total leads synced: ${syncedCount}`);
}

runSync().catch(console.error);
