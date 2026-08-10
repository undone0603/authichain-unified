const fs = require("fs");
const root = "/home/zac/authichain-unified/server/";

// pipeline-tick.test.ts — inline objects (5x)
{
  const p = root + "pipeline-tick.test.ts";
  const before = fs.readFileSync(p, "utf8");
  const after = before.split("error: null, order: 0, createdAt: new Date()")
    .join("error: null, order: 0, priority: 0, result: null, scheduledAt: null, createdAt: new Date()");
  fs.writeFileSync(p, after);
  console.log(`pipeline-tick.test.ts: ${before === after ? "NO CHANGE" : "updated"}`);
}

// agents.test.ts + task-runner.test.ts — multiline makeTask return
for (const f of ["agents.test.ts", "task-runner.test.ts"]) {
  const p = root + f;
  const before = fs.readFileSync(p, "utf8");
  const after = before.replace(
    "    order: 0,\n    createdAt: new Date(),\n    updatedAt: new Date(),\n  };",
    "    order: 0,\n    priority: 0,\n    result: null,\n    scheduledAt: null,\n    createdAt: new Date(),\n    updatedAt: new Date(),\n  };"
  );
  fs.writeFileSync(p, after);
  console.log(`${f}: ${before === after ? "NO CHANGE" : "updated"}`);
}
