const fs = require("fs");
const root = "/home/zac/authichain-unified/server/";
const files = ["auth.logout.test.ts", "missions.test.ts", "new-features.test.ts", "new-routers.test.ts", "routers.test.ts"];
const inject = "stripeCustomerId: null,\n    walletAddress: null, avatarUrl: null, company: null, title: null, phone: null, onboardingCompleted: 0, paddleCustomerId: null, points: 0,";
for (const f of files) {
  const p = root + f;
  const before = fs.readFileSync(p, "utf8");
  // only the first occurrence (the user mock)
  const after = before.replace("stripeCustomerId: null,", inject);
  fs.writeFileSync(p, after);
  console.log(`${f}: ${before === after ? "NO CHANGE" : "updated"}`);
}
