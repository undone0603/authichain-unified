import { db } from '../server/db';
import { webhookEvents } from '../drizzle/schema';
import { desc } from 'drizzle-orm';

async function report() {
  const d = await db;
  const events = await d.select().from(webhookEvents).orderBy(desc(webhookEvents.receivedAt)).limit(50);
  console.log("Recent Webhook Events:");
  console.table(events);
}

report().catch(console.error);
