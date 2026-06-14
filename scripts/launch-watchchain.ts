import { forgeVertical } from "../server/vertical-factory";

async function main() {
  console.log("🚀 Launching WatchChain.io via Domain Forge...");
  const result = await forgeVertical({
    id: "watchchain-io",
    displayName: "WatchChain",
    tagline: "Luxury Timepiece Provenance",
    domain: "watchchain.io",
    industry: "Luxury Watches",
    primaryColor: "#d4af37",
    primaryDim: "#b8941f"
  });
  console.log("✅ Success!", JSON.stringify(result, null, 2));
}

main().catch(console.error);
