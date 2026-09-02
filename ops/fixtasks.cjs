const fs = require("fs");
const root = path.join(__dirname, "../server/");
const edits = [
  ["agents.test.ts", s => s.replace("lastError: null,", "error: null,")],
  ["pipeline-tick.test.ts", s => s.split("lastError: null").join("error: null")],
  ["task-runner.test.ts", s => s.replace("lastError: null,", "error: null,")],
  ["agents/dev-team/router.ts", s => s.replace('.set({ status: "pending", lastError: null, retryCount: 0 })', '.set({ status: "pending", error: null })')],
  ["missions/seed.ts", s => s.replace("lastError: 'seeded failure for test'", "error: 'seeded failure for test'")],
];
for (const [rel, fn] of edits) {
  const p = root + rel;
  const before = fs.readFileSync(p, "utf8");
  const after = fn(before);
  fs.writeFileSync(p, after);
  console.log(`${rel}: ${before === after ? "NO CHANGE" : "updated"}`);
}
