import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = "docs/accountability-identities";
const fixtures = ["epstein.identity.json"];

for (const file of fixtures) {
  const identity = JSON.parse(await readFile(join(root, file), "utf8"));
  if (identity.schema_version !== "accountability-identity.v0.1") throw new Error(file + ": bad schema version");
  if (identity.identity?.identity_status !== "deceased_perpetrator_record") throw new Error(file + ": identity status");
  if (!identity.sources?.length || !identity.claims?.length || !identity.temporal_states?.length) throw new Error(file + ": missing graph nodes");

  const sourceIds = new Set(identity.sources.map(s => s.source_id));
  const claimIds = new Set(identity.claims.map(c => c.claim_id));

  for (const claim of identity.claims) {
    const supported = identity.evidence_edges.some(e =>
      e.to === claim.claim_id &&
      ["supports","contextualizes","contradicts","derived_from"].includes(e.relation) &&
      sourceIds.has(e.from)
    );
    const bounded = identity.evidence_edges.some(e => e.to === claim.claim_id && e.relation === "bounds");
    if (!supported && !bounded) throw new Error(file + ": claim without source evidence or explicit protocol boundary: " + claim.claim_id);
  }

  for (const state of identity.temporal_states) {
    if (!state.knowledge_cutoff) throw new Error(file + ": temporal state missing knowledge cutoff");
    for (const claimId of state.known_claim_ids) if (!claimIds.has(claimId)) throw new Error(file + ": state references unknown claim " + claimId);
  }

  for (const survivor of identity.survivor_records) {
    if (survivor.identifier_policy !== "no_direct_identifier") throw new Error(file + ": survivor record permits direct identifier");
    if (!["public_pseudonymous","restricted","counsel_only","excluded"].includes(survivor.visibility)) throw new Error(file + ": invalid survivor visibility");
  }

  console.log(file + ": OK");
}
console.log("accountability identity fixtures: PASS");
