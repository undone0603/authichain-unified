import "dotenv/config";
import fs from "fs";
import path from "path";

// Load from qron-platform/.env.local since it has the real keys
const qronEnvPath = path.join(process.cwd(), "..", "qron-platform", ".env.local");
if (fs.existsSync(qronEnvPath)) {
  const envContent = fs.readFileSync(qronEnvPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [key, ...valueParts] = trimmed.split("=");
    if (key && valueParts.length > 0) {
      const k = key.trim();
      const v = valueParts.join("=").trim();
      if (!process.env[k]) process.env[k] = v;
    }
  });
}

import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "../server/email/smtp";

// Override SMTP settings with Gmail ones if available
process.env.SMTP_USER = process.env.SMTP_USER || process.env.GMAIL_USER;
process.env.SMTP_PASS = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
process.env.SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
process.env.SMTP_PORT = process.env.SMTP_PORT || "587";
process.env.SMTP_FROM = process.env.SMTP_FROM || "outreach@authichain.com";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function sendDrafts() {
  console.log("🟠 Starting Outreach Dispatch...");

  const { data: drafts, error: fetchError } = await supabase
    .from('email_drafts')
    .select('*')
    .eq('status', 'draft')
    .limit(20);

  if (fetchError) {
    console.error("❌ Failed to fetch drafts:", fetchError.message);
    return;
  }

  if (!drafts || drafts.length === 0) {
    console.log("ℹ️ No drafts pending send.");
    return;
  }

  console.log(`📡 Found ${drafts.length} drafts. Sending...`);

  let sentCount = 0;
  for (const draft of drafts) {
    try {
      console.log(`📧 Sending to ${draft.to_email}...`);
      
      await sendEmail({
        to: draft.to_email,
        subject: draft.subject,
        text: draft.body,
        from: process.env.SMTP_FROM
      });

      const { error: updateError } = await supabase
        .from('email_drafts')
        .update({ 
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', draft.id);

      if (updateError) {
        console.error(`✗ Failed to update status for ${draft.to_email}:`, updateError.message);
      } else {
        sentCount++;
        console.log(`✅ Sent and updated: ${draft.to_email}`);
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 1000));

    } catch (e: any) {
      console.error(`✗ Error sending to ${draft.to_email}: ${e.message}`);
    }
  }

  console.log(`\n✨ Dispatch Complete. Total sent: ${sentCount}`);
}

sendDrafts().catch(console.error);
