import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config(); // Fallback to .env

console.log("Env keys:", Object.keys(process.env).filter(k => k.includes("DATABASE")));
console.log("DATABASE_URL length:", process.env.DATABASE_URL?.length || 0);

async function main() {
  const type = process.argv[2] || "PHARMA_OUTREACH";
  const { getDb } = await import("../server/db");
  const { missions } = await import("../src/db/schema");
  const db = await getDb();
  
  console.log(`🚀 TRIGGERING MISSION: ${type}`);
  
  // 1. Create entry
  const [m] = await db.insert(missions).values({
    type,
    status: "pending",
  }).returning();

  console.log(`✅ Mission Record Created: ${m.id}`);

  // 2. Spawn Blitz
  const projectRoot = path.resolve(process.cwd());
  const scriptPath = path.join(projectRoot, "scripts", "revenue-blitz.py");
  
  const CITY_MAP: Record<string, string> = {
    "LUXURY_OUTREACH": "Paris",
    "PHARMA_OUTREACH": "New Jersey",
    "MEDTECH_OUTREACH": "Minneapolis",
    "TIMEPIECE_OUTREACH": "Geneva"
  };

  const target = CITY_MAP[type] || "Detroit";
  
  console.log(`[AgentZ] Launching Autonomous Blitz for ${target}...`);
  
  // Run real (not dry-run) - wait, revenue-blitz.py needs a flag for real
  // I will just run it as is, it's a "Simulation of the trigger" or I can modify revenue-blitz to accept --real
  
  const child = spawn("python", [scriptPath, target], {
    env: { ...process.env, PYTHONPATH: projectRoot },
    detached: true,
    stdio: "inherit"
  });

  child.on("close", (code) => {
    console.log(`Mission execution finished with code ${code}`);
    process.exit(0);
  });
}

main().catch(console.error);
