import "dotenv/config";
import fs from "fs";
import path from "path";
import { invokeLLM } from "../server/_core/llm";
import { ENV } from "../server/_core/env";

// ── Environment Setup ────────────────────────────────────────────────────────
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
      if (k === "BUILT_IN_FORGE_API_KEY") process.env.OPENAI_API_KEY = v;
    }
  });
}

// Force ENV values from process.env into the ENV singleton used by server core
const openAiKey = process.env.OPENAI_API_KEY;
if (!openAiKey) {
  console.error("FATAL: OPENAI_API_KEY must be set in .env (or process environment).");
  process.exit(1);
}
(ENV as any).forgeApiKey = openAiKey;
(ENV as any).openaiApiKey = openAiKey;
(ENV as any).forgeApiUrl = "https://api.openai.com";

// Supabase REST API for the Michigan cannabis extraction workspace.
// Service role is required (bypasses RLS for admin writes to leads / activity_log
// / autopilot_decisions). Must be set in .env — never commit it.
const supabaseUrl = process.env.SUPABASE_MI_URL;
const supabaseKey = process.env.SUPABASE_MI_SERVICE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("FATAL: SUPABASE_MI_URL and SUPABASE_MI_SERVICE_KEY must be set in .env.");
  console.error("The service_role key that was previously hardcoded MUST be rotated at");
  console.error("https://supabase.com/dashboard/project/dbwoikpflfruikspdnfc/settings/api");
  process.exit(1);
}

async function supabaseRest(table: string, method: string, body?: any, query?: string) {
  const url = `${supabaseUrl}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const headers: Record<string, string> = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase REST Error: ${response.status} ${text}`);
  }

  return await response.json();
}

async function upsertLeadDirect(data: any) {
  const { email, ...rest } = data;
  
  // Check if existing
  const existing = await supabaseRest('leads', 'GET', undefined, `email=eq.${email.toLowerCase()}&select=id`);
  
  if (existing && existing.length > 0) {
    const updated = await supabaseRest('leads', 'PATCH', rest, `id=eq.${existing[0].id}`);
    return { id: existing[0].id, created: false };
  } else {
    const inserted = await supabaseRest('leads', 'POST', { email: email.toLowerCase(), ...rest });
    return { id: inserted[0].id, created: true };
  }
}

async function logActivityDirect(data: any) {
  try {
    await supabaseRest('activity_log', 'POST', data);
  } catch (e: any) {
    console.warn("⚠️ Failed to log activity:", e.message);
  }
}

async function createAutopilotDecisionDirect(data: any) {
  try {
    await supabaseRest('autopilot_decisions', 'POST', data);
  } catch (e: any) {
    console.warn("⚠️ Failed to log autopilot decision:", e.message);
  }
}

// ── Extraction Logic ──────────────────────────────────────────────────────────

// Logging file to track processed entities across runs
const LOG_FILE = path.join(process.cwd(), "logs", "mi_cannabis_processed.json");

interface ExtractionTarget {
  entityName: string;
  dba: string;
  city: string;
  type: "Processor" | "Microbusiness" | "Establishment";
  email?: string;
}

const SAMPLE_DATA: ExtractionTarget[] = [
  { entityName: "Love Supreme Cultivations", dba: "Love Supreme", city: "Grand Rapids", type: "Microbusiness", email: "info@lovesupremecannabis.com" },
  { entityName: "Green Peak Industries LLC", dba: "Skymint", city: "Lansing", type: "Processor" },
  { entityName: "Lion Labs Ltd", dba: "Lion Labs", city: "Lansing", type: "Processor", email: "erik@lionlabsmi.com" },
  { entityName: "Fluresh LLC", dba: "Tend.Harvest.Cultivate.", city: "Grand Rapids", type: "Processor", email: "bobschwartz@tendharvestcultivate.com" },
  { entityName: "Fortuo", dba: "Fortuo", city: "Lansing", type: "Microbusiness", email: "info@fortuo.com" },
  { entityName: "Jartnick Consulting LLC", dba: "Truu Cannabis", city: "Lansing", type: "Processor" },
  { entityName: "SJS II LLC", dba: "Insano Pharms", city: "Lansing", type: "Processor" },
  { entityName: "Driven Grow LLC", dba: "Driven Grow", city: "Lansing", type: "Processor" },
  { entityName: "Premier Botanics LLC", dba: "Premier Botanics", city: "Lowell", type: "Microbusiness" },
  { entityName: "IndiGrow LLC", dba: "IndiGrow", city: "Muskegon", type: "Microbusiness" },
  { entityName: "1520 Cavanaugh II LLC", dba: "Cavanaugh", city: "Lansing", type: "Processor" }
];

const SQL_OUTPUT_FILE = path.join(process.cwd(), "scripts", "mi_cannabis_leads.sql");

async function runExtractionLoop() {
  console.log("🗺️ Starting Michigan Cannabis Extraction Protocol...");

  // Ensure log directory exists
  if (!fs.existsSync(path.dirname(LOG_FILE))) fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });

  // Load processed logs
  let processed: string[] = [];
  if (fs.existsSync(LOG_FILE)) {
    processed = JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
  }

  const sqlStatements: string[] = [];

  for (const target of SAMPLE_DATA) {
    const targetKey = `${target.entityName}:${target.city}`.toLowerCase();
    
    if (processed.includes(targetKey)) {
      console.log(`⏩ Skipping ${target.entityName} (already processed)`);
      continue;
    }

    console.log(`\n🔍 Vector 1: Processing ${target.entityName} in ${target.city}...`);

    // Vector 2: Synergy (Apollo/Hunter Simulation)
    let finalEmail = target.email;
    let decisionMaker = "Operations Director";

    if (!finalEmail) {
      console.log(`⚡ Vector 2: Email missing for ${target.entityName}. Invoking Synergy...`);
      try {
        const prompt = `Find the most likely email for the Director of Operations or Compliance Manager at ${target.entityName} (${target.dba}) in ${target.city}, MI. 
        Use common patterns: {first}@{domain}, {first}.{last}@{domain}. 
        Known domain: ${target.dba.toLowerCase().replace(/\s+/g, '')}.com
        Return JSON: { "email": "string", "name": "string", "title": "string" }`;

        const response = await invokeLLM({
          messages: [{ role: "system", content: prompt }],
          responseFormat: { type: "json_object" }
        });

        const synergy = JSON.parse(response.choices[0].message.content as string);
        finalEmail = synergy.email;
        decisionMaker = synergy.name || decisionMaker;
      } catch (synergyErr: any) {
        console.warn(`⚠️ Synergy Failed: ${synergyErr.message}. Using manual pattern fallback.`);
        const domain = `${target.dba.toLowerCase().replace(/\s+/g, '')}.com`;
        finalEmail = `ops@${domain}`;
        decisionMaker = "Operations Director (Predicted)";
      }
    }

    if (finalEmail) {
      // Vector 3: CRM Injection
      console.log(`🚀 Vector 3: Injecting ${target.entityName} into CRM with email ${finalEmail}...`);
      
      const metadata = { 
        dba: target.dba, 
        city: target.city, 
        type: target.type,
        tax_vulnerability: "high (24% wholesale)"
      };

      // Add to SQL collection
      sqlStatements.push(`INSERT INTO leads (email, name, company, source, industry, metadata) VALUES ('${finalEmail.toLowerCase()}', '${decisionMaker}', '${target.entityName}', 'MI_CRA_EXTRACTION_PROTOCOL', 'Cannabis', '${JSON.stringify(metadata)}') ON DUPLICATE KEY UPDATE name=VALUES(name), company=VALUES(company), metadata=VALUES(metadata);`);

      try {
        const { id: leadId, created } = await upsertLeadDirect({
          email: finalEmail.toLowerCase(),
          name: decisionMaker,
          company: target.entityName,
          source: "MI_CRA_EXTRACTION_PROTOCOL",
          industry: "Cannabis",
          metadata
        });

        // Log Autopilot Decision
        await createAutopilotDecisionDirect({
          type: "lead_generation",
          action: `Extract & Verify ${target.entityName}`,
          reasoning: `High-value ${target.type} target in ${target.city} identified via CRA database vector.`,
          confidence: 90,
          status: "executed",
          result: { leadId, created, targetKey }
        });

        await logActivityDirect({
          userId: 1, // System
          action: created ? "lead_extracted" : "lead_updated",
          entityType: "lead",
          entityId: leadId,
          details: { target, finalEmail, decisionMaker }
        });

        // Update local log only on success
        processed.push(targetKey);
        fs.writeFileSync(LOG_FILE, JSON.stringify(processed, null, 2));
        console.log(`✅ ${target.entityName} logged successfully.`);
      } catch (dbErr: any) {
        console.error(`✗ Database Error for ${target.entityName}:`, dbErr.message || dbErr);
        console.log("⏭️ Continuing to next target (SQL will still be generated)...");
      }
    } else {
      console.error(`✗ Failed to extract valid email for ${target.entityName}`);
    }
  }

  if (sqlStatements.length > 0) {
    fs.writeFileSync(SQL_OUTPUT_FILE, sqlStatements.join("\n"));
    console.log(`\n📄 SQL migration script generated at: ${SQL_OUTPUT_FILE}`);
  }

  console.log("\n✨ Extraction Protocol Loop Complete.");
}

runExtractionLoop().catch(console.error);
