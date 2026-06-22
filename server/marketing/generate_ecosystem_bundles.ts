import { runSocialMultiplier } from "./multiplier.js";

async function generateAllEcosystemBundles() {
  console.log("🌌 Generating Social Multiplier Bundles for the Ecosystem...");

  const targets = [
    {
      id: "qron",
      announcement: "QRON.space launches 'Dimensional Gateways'—AI-powered cinematic identity for physical products. Proven to increase consumer scan rates by 78% vs standard QR codes. Every gateway is cryptographically signed and anchored to the AuthiChain Protocol."
    },
    {
      id: "strainchain",
      announcement: "StrainChain.io is now the automated 'Truth Layer' for Michigan cannabis. Our new background job automatically anchors METRC manifests to Bitcoin L1, providing cultivators with an immutable 'Proof of Purity' certificate for every package tag."
    },
    {
      id: "govchain",
      announcement: "GovChain.us achieves 'Sovereign Document' status. With our newly verified CAGE Code 1PUJ6, we are deploying W3C Verifiable Credentials for federal and defense supply chains. Secure your credentials with FIPS 140-2 HSM-grade cryptographic truth."
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
