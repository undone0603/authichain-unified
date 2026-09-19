import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = "docs/historical-identities";
const fixtures = ["tesla.identity.json", "franklin.identity.json", "tubman.identity.json"];

for (const file of fixtures) {
  const identity = JSON.parse(await readFile(join(root, file), "utf8"));
  if (identity.schema_version !== "historical-identity.v0.1") throw new Error(file + ": bad schema version");
  if (identity.identity?.identity_status !== "deceased_historical_figure") throw new Error(file + ": identity status");
  if (!identity.sources?.length || !identity.claims?.length || !identity.temporal_states?.length) throw new Error(file + ": missing graph nodes");
  const sourceIds = new Set(identity.sources.map((s) => s.source_id));
  const claimIds = new Set(identity.claims.map((c) => c.claim_id));
  for (const claim of identity.claims) {
    const supported = identity.evidence_edges.some((e) =>
      e.to === claim.claim_id && ["supports","contextualizes","contradicts","derived_from"].includes(e.relation) && sourceIds.has(e.from)
    );
    if (!supported) throw new Error(file + ": claim without source evidence: " + claim.claim_id);
  }
  for (const state of identity.temporal_states) {
    if (!state.knowledge_cutoff) throw new Error(file + ": temporal state missing knowledge cutoff");
    for (const claimId of state.known_claim_ids) if (!claimIds.has(claimId)) throw new Error(file + ": state references unknown claim " + claimId);
  }
  console.log(file + ": OK");
}
console.log("historical identity fixtures: PASS");
