import { runSocialMultiplier } from "./multiplier.js";

async function generateAllEcosystemBundles() {
  console.log("🌌 Generating Social Multiplier Bundles for the Ecosystem...");

  const targets = [
    // Each announcement must name its own domain — that is what routes it to the
    // right fallback bundle in multiplier.ts. Announcements must not carry
    // statistics or certification claims: the LLM is instructed not to invent
    // numbers, but it will faithfully repeat any number handed to it.
    {
      id: "qron",
      announcement: "QRON.space launches 'Dimensional Gateways'—AI-powered cinematic identity for physical products. Every gateway is cryptographically signed with Ed25519 and anchored to the AuthiChain Protocol."
    },
    {
      id: "strainchain",
      announcement: "StrainChain.io is now the automated 'Truth Layer' for Michigan cannabis. Our new background job automatically anchors METRC manifests to Bitcoin L1, providing cultivators with an immutable 'Proof of Purity' record for every package tag."
    },
    {
      id: "govchain",
      announcement: "GovChain.us achieves 'Sovereign Document' status. With our newly verified CAGE Code 1PUJ6, we are deploying W3C Verifiable Credentials for federal and defense supply chains, signed with Ed25519 and verifiable offline."
    }
  ];

  const results: Record<string, any> = {};

  for (const target of targets) {
    console.log(`\n📢 Processing: ${target.id.toUpperCase()}...`);
    results[target.id] = await runSocialMultiplier(target.announcement);
  }

  console.log("\n--- ECOSYSTEM BUNDLE EXPORT ---");
  console.log(JSON.stringify(results, null, 2));
}

generateAllEcosystemBundles().catch(console.error);
