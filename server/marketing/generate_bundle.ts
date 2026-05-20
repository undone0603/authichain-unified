import "dotenv/config";
import { runSocialMultiplier } from "./multiplier.js";

async function generateTrafficBundle() {
  const announcement = "AuthiChain launches the high-ticket MedTech Compliance vertical. Manufacturers can now automate ISO 13485 audit trails on-chain and quantify their Trust Advantage via our interactive ROI Calculator.";
  
  const content = await runSocialMultiplier(announcement);
  
  if (content) {
    console.log("\n🔥 Organic Traffic Bundle Generated:");
    console.log("------------------------------------");
    console.log(`\n[LINKEDIN]\n${content.linkedin}`);
    console.log(`\n[REDDIT - ${content.reddit.title}]\n${content.reddit.body}`);
    console.log("\n[TWITTER THREAD]");
    content.twitter.forEach((t: string, i: number) => console.log(`${i+1}/ ${t}`));
    console.log("------------------------------------");
    console.log("\n🚀 Action: Post these manually or via AgentZ browser-use to drive organic leads to /roi-calculator.");
  }
}

generateTrafficBundle().catch(console.error);
