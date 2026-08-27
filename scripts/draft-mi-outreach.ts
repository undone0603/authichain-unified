import "dotenv/config";
import fs from "fs";
import path from "path";

// ── Environment Setup ────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import { ExecutiveAgent } from "../server/agents/executive";

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("FATAL: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const executive = new ExecutiveAgent();

const CSV_FILE = path.join(process.cwd(), "scripts", "mi_cannabis_leads.csv");

async function draftOutreach() {
  console.log("🟠 Starting Michigan Margin Protection Draft Generation...");

  if (!fs.existsSync(CSV_FILE)) {
    console.error(`❌ CSV file not found at: ${CSV_FILE}`);
    return;
  }

  const content = fs.readFileSync(CSV_FILE, "utf-8");
  const lines = content.split("\n").slice(1); // Skip header

  let draftedCount = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // email,first_name,company,dba,city,type,tax_vulnerability
    const [email, first_name, company, dba, city, type, tax_vulnerability] = line.split(",");

    const prospect = {
      name: first_name === "Operations Director" ? `${dba} Operations` : first_name,
      email: email.trim(),
      company: company.trim(),
      dba: dba.trim(),
      city: city.trim(),
      industry: "Cannabis",
      type: type.trim()
    };

    console.log(`📡 Drafting for ${prospect.email} (${prospect.dba})...`);
    
    try {
      // Check if draft already exists
      const { data: existing } = await supabase
        .from('email_drafts')
        .select('id')
        .eq('to_email', prospect.email)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`⏭️  Draft already exists for ${prospect.email}. Skipping.`);
        continue;
      }

      const body = await executive.draftMarginProtectionEmail(prospect);
      const subject = `Margin Protection for ${prospect.dba} in ${prospect.city}`;

      const insertData: any = {
        to_email: prospect.email,
        subject: subject,
        body: body,
        status: 'draft',
        metadata: {
          prospectName: prospect.name,
          prospectCompany: prospect.company,
          industry: prospect.industry,
          dba: prospect.dba,
          city: prospect.city,
          type: prospect.type,
          tax_vulnerability: tax_vulnerability,
          generatedBy: 'executive_agent'
        }
      };

      const { error } = await supabase.from('email_drafts').insert(insertData);

      if (error) {
        console.error(`✗ Failed to save draft for ${prospect.email}:`, error.message);
      } else {
        draftedCount++;
        console.log(`✅ Draft saved: ${prospect.email}`);
      }
    } catch (e: any) {
      console.error(`✗ Error drafting for ${prospect.email}: ${e.message}`);
    }
  }

  console.log(`\n✨ Draft Generation Complete. Total drafts created: ${draftedCount}`);
}

draftOutreach().catch(console.error);
