import "dotenv/config";
import { runSocialMultiplier } from "./multiplier.js";

async function generateTrafficBundle() {
  // Points at authichain.com/protocol, which exists. The previous announcement
  // sold an "interactive ROI Calculator" at authichain.com/roi-calculator —
  // a route the worker serving authichain.com does not handle, so it silently
  // rendered the marketing homepage instead.
  const announcement = "AuthiChain has opened its verification protocol under Apache-2.0: the specification, a zero-dependency reference verifier and a 28-fixture conformance suite are public at authichain.com/protocol. Any implementation can run the suite and claim conformance.";
  
  const content = await runSocialMultiplier(announcement);
  
  if (content) {
    console.log("\n🔥 Organic Traffic Bundle Generated:");
    console.log("------------------------------------");
    console.log(`\n[LINKEDIN]\n${content.linkedin}`);
    console.log(`\n[REDDIT - ${content.reddit.title}]\n${content.reddit.body}`);
    console.log("\n[TWITTER THREAD]");
    content.twitter.forEach((t: string, i: number) => console.log(`${i+1}/ ${t}`));
    console.log("------------------------------------");
    console.log("\n🚀 Action: Post these manually or via AgentZ browser-use to drive organic leads to /protocol.");
  }
}

generateTrafficBundle().catch(console.error);
