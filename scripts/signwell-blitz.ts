/**
 * SignWell Blitz Script - Zero-cost DocuSign replacement
 * Replaces docusign_blitz.ts for AuthiChain outreach flows
 * 
 * Usage: npx tsx scripts/signwell-blitz.ts
 * 
 * Environment variables:
 * - SIGNWELL_API_KEY: Your SignWell API key (get from signwell.com)
 * - SIGNWELL_TEST_MODE: Set to "true" to create drafts only (no sends)
 * - SIGNWELL_TEMPLATE_ID: The template ID for outreach documents
 */

import * as fs from "fs";
import * as path from "path";
import { SignWellClient, createSignWellClientFromEnv, type OutreachRecipient } from "./lib/signwell";

interface OutreachQueueItem {
  id: string;
  status: "pending" | "sent" | "signed" | "failed";
  contact: {
    name: string;
    email: string;
    company?: string;
    title?: string;
  };
  sentAt?: string;
  signedAt?: string;
  errorCode?: string;
  errorMessage?: string;
}

interface OutreachQueue {
  queue: OutreachQueueItem[];
  metadata: {
    lastUpdated: string;
    totalSent: number;
    totalSigned: number;
    totalPending: number;
  };
}

const QUEUE_FILE = path.join(process.cwd(), "scripts", "kv-data", "outreach_queue.json");
const DELAY_MS = 2000;

function loadQueue(): OutreachQueue {
  try {
    const raw = fs.readFileSync(QUEUE_FILE, "utf-8");
    return JSON.parse(raw) as OutreachQueue;
  } catch (err) {
    console.error(`Failed to load queue from ${QUEUE_FILE}`);
    process.exit(1);
  }
}

function saveQueue(queue: OutreachQueue) {
  const updated: OutreachQueue = {
    ...queue,
    metadata: {
      lastUpdated: new Date().toISOString(),
      totalSent: queue.queue.filter((i) => i.status === "sent").length,
      totalSigned: queue.queue.filter((i) => i.status === "signed").length,
      totalPending: queue.queue.filter((i) => i.status === "pending").length,
    },
  };
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(updated, null, 2));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("=".repeat(60));
  console.log("  SignWell Blitz - AuthiChain Outreach Automation");
  console.log("=".repeat(60));

  let client: SignWellClient;
  try {
    client = createSignWellClientFromEnv();
  } catch (err) {
    console.error((err as Error).message);
    console.log("\nRequired env vars: SIGNWELL_API_KEY");
    console.log("Optional: SIGNWELL_TEST_MODE=true, SIGNWELL_TEMPLATE_ID");
    process.exit(1);
  }

  console.log(`\nConnected to SignWell (${client.isTestMode() ? "TEST MODE" : "LIVE"} )`);
  console.log(`Remaining free docs this month: ${client.getRemainingFreeDocs()}`);

  if (!process.env.SIGNWELL_TEMPLATE_ID) {
    console.log("\nNo SIGNWELL_TEMPLATE_ID set. Running in list/get templates mode only.");
    try {
      const templates = await client.getTemplates();
      if (templates.length === 0) {
        console.log("No templates found. Create one at https://app.signwell.com");
      } else {
        console.log("\nAvailable templates:");
        templates.forEach((t) => console.log(`  - ${t.id}: ${t.title}`));
      }
    } catch (err) {
      console.error(`Template fetch error: ${(err as Error).message}`);
    }
    process.exit(0);
  }

  const queue = loadQueue();
  const pendingItems = queue.queue.filter((item) => item.status === "pending");

  console.log(`\nQueue: ${pendingItems.length} pending item(s) out of ${queue.queue.length} total`);

  if (pendingItems.length === 0) {
    console.log("No pending items to process. Done.");
    process.exit(0);
  }

  if (pendingItems.length > client.getRemainingFreeDocs()) {
    console.warn(
      `\nWARNING: ${pendingItems.length} pending items but only ${client.getRemainingFreeDocs()} free docs remaining this month.`
    );
  }

  for (const item of pendingItems) {
    console.log(`\n[${new Date().toISOString()}] Processing: ${item.contact.name} (${item.contact.email})`);

    try {
      const recipient: OutreachRecipient = {
        name: item.contact.name,
        email: item.contact.email,
        company: item.contact.company,
        role: item.contact.title,
      };

      const docTitle = `AuthiChain Partnership Agreement - ${item.contact.company ?? "Partner"}`;

      const doc = await client.createOutreachDocument(
        process.env.SIGNWELL_TEMPLATE_ID!,
        recipient,
        docTitle,
        [],
        `Hi ${item.contact.name}, we'd love to partner with ${item.contact.company ?? "your organization"}. Please review and sign this agreement to get started.`
      );

      console.log(`  Document created: ${doc.id}`);

      if (item) {
        item.status = "sent";
        item.sentAt = new Date().toISOString();
        saveQueue(queue);
      }

      console.log(`  Status updated to: sent`);

      await delay(DELAY_MS);
    } catch (err) {
      console.error(`  ERROR: ${(err as Error).message}`);
      if (item) {
        item.status = "failed";
        item.errorCode = "api_error";
        item.errorMessage = (err as Error).message;
        saveQueue(queue);
      }
    }
  }

  const results = loadQueue();
  console.log("\n" + "=".repeat(60));
  console.log("  Blitz Complete");
  console.log("=".repeat(60));
  console.log(`Total queue: ${results.queue.length}`);
  console.log(`Sent: ${results.metadata.totalSent}`);
  console.log(`Signed: ${results.metadata.totalSigned}`);
  console.log(`Pending: ${results.metadata.totalPending}`);
  console.log(`Remaining free docs: ${client.getRemainingFreeDocs()}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
