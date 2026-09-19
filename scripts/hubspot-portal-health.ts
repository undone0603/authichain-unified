import "dotenv/config";
import {
  HUBSPOT_PORTAL,
  hubspotPortalHome,
} from "../server/hubspot-portal";
import { getCRMStats, isHubSpotConfigured } from "../server/hubspot-service";

/**
 * Health-check the Grok-connected Authichain HubSpot portal.
 *
 * Usage (from repo root):
 *   npx tsx scripts/hubspot-portal-health.ts
 *
 * Auth: HUBSPOT_SERVICE_KEY (private app token). The Grok connector is an
 * OAuth grant for interactive agents and does not replace this key in CI.
 */
async function main() {
  console.log("HubSpot portal binding");
  console.log(`  name        ${HUBSPOT_PORTAL.name}`);
  console.log(`  portalId    ${HUBSPOT_PORTAL.id}`);
  console.log(`  ui          ${hubspotPortalHome()}`);
  console.log(`  timezone    ${HUBSPOT_PORTAL.timezone}`);
  console.log(`  ownerId     ${HUBSPOT_PORTAL.ownerId}`);
  console.log(
    `  grok        ${
      HUBSPOT_PORTAL.grokConnector.connected
        ? "connected " + HUBSPOT_PORTAL.grokConnector.connectedAt
        : "no"
    }`,
  );

  if (!isHubSpotConfigured()) {
    console.error(
      "\nHUBSPOT_SERVICE_KEY is not set. Portal identity is bound, but API calls cannot run.",
    );
    console.error(
      "Add a private app token for CI / AgentZ. The Grok connector is chat-side only.",
    );
    process.exit(2);
  }

  const stats = await getCRMStats();
  if (!stats.connected) {
    console.error("\nHubSpot API unreachable:", stats.error ?? "unknown error");
    if (stats.missingScopes?.length) {
      console.error("  missing scopes:", stats.missingScopes.join(", "));
    }
    process.exit(1);
  }

  console.log("\nCRM snapshot");
  console.log(`  contacts    ${stats.contacts}`);
  console.log(`  companies   ${stats.companies}`);
  console.log(`  deals       ${stats.deals}`);
  console.log("\nOK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
