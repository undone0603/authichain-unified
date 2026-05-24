import "dotenv/config";
import postgres from "postgres";

async function triggerLuxuryMission() {
  // Try the production URL found in workspace memories first
  const prodUrl = "postgresql://postgres.dbwoikpflfruikspdnfc:Fuckit06031991!11@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require";
  const envUrl = process.env.DATABASE_URL;
  
  const targetUrl = prodUrl || envUrl;
  
  if (!targetUrl) {
    console.error("No database URL found.");
    return;
  }

  console.log(`🚀 Connecting to: ${targetUrl.split('@')[1]}...`);
  const sql = postgres(targetUrl);

  try {
    console.log("🚀 Enqueuing Luxury Outreach Mission...");

    // 1. Create the mission record
    const [mission] = await sql`
      INSERT INTO missions (type, status, priority, title, created_at, updated_at)
      VALUES ('LUXURY_OUTREACH', 'PLANNED', 10, 'Luxury Outreach – High-End Brands (CLI Launch)', NOW(), NOW())
      RETURNING id
    `;

    console.log(`✅ Mission created with ID: ${mission.id}`);

    // 2. Add the initial tasks
    await sql`
      INSERT INTO mission_tasks (mission_id, kind, status, priority, payload, created_at, updated_at)
      VALUES 
        (${mission.id}, 'FIND_LUXURY_LEADS', 'PENDING', 1, '{"count": 20, "icp": "Head of Brand Protection at luxury fashion houses"}'::jsonb, NOW(), NOW()),
        (${mission.id}, 'DRAFT_OUTBOUND_EMAIL', 'PENDING', 2, '{"segment": "LUXURY", "sequence": 1}'::jsonb, NOW(), NOW())
    `;

    console.log("✨ Luxury Outreach pipeline initialized. AgentZ is now active.");
    console.log("Check the '/email-campaigns' dashboard to approve the first drafts.");

  } catch (err) {
    console.error("Failed to trigger mission:", err);
  } finally {
    await sql.end();
  }
}

triggerLuxuryMission().catch(console.error);

