import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = "docs/living-identities";
const fixture = JSON.parse(await readFile(join(root, "example.identity.json"), "utf8"));

function validate(identity) {
  if (identity.schema_version !== "living-identity.v0.1") throw new Error("bad schema version");
  if (identity.identity?.status !== "living_person") throw new Error("identity must be a living person");
  if (!identity.identity?.identity_id?.startsWith("person:")) throw new Error("invalid person identity id");
  if (!identity.claims?.length || !identity.sources?.length) throw new Error("missing claims or sources");

  const sourceIds = new Set(identity.sources.map(s => s.source_id));
  for (const claim of identity.claims) {
    if (claim.state === "self_attested" && !claim.source_ids?.length) throw new Error("self-attested claim lacks attestation source");
    if (claim.source_ids?.some(id => !sourceIds.has(id))) throw new Error("claim references unknown source");
    if (claim.sensitive === true) throw new Error("sensitive personal data must be excluded from the public fixture");
    if (["trust_score","morality_score","credibility_score","political_score","social_worth_score"].includes(claim.predicate)) {
      throw new Error("person-level evaluative score is prohibited");
    }
  }

  for (const auth of identity.authorizations ?? []) {
    if (auth.status === "active" && !auth.expires_at) throw new Error("active authorization requires expiry");
    if (auth.principal_identity_id !== identity.identity.identity_id) throw new Error("authorization principal mismatch");
    if (auth.capabilities?.includes("impersonate_human")) throw new Error("human impersonation capability is prohibited");
  }
}

validate(fixture);

const negatives = JSON.parse(await readFile(join(root, "negative-fixtures.json"), "utf8"));
for (const test of negatives.cases) {
  const candidate = structuredClone(fixture);
  if (test.claim) candidate.claims.push({
    claim_id: "claim:negative",
    predicate: test.claim.predicate ?? "negative_test",
    object: true,
    state: "third_party_claim",
    source_ids: test.claim.source_ids ?? ["src:public-profile"],
    sensitive: test.claim.sensitive ?? false
  });
  if (test.authorization) candidate.authorizations.push({
    authorization_id: "authz:negative",
    principal_identity_id: candidate.identity.identity_id,
    delegate_id: "agent:negative",
    capabilities: test.authorization.capabilities ?? ["support"],
    effective_from: "2026-09-19T00:00:00Z",
    expires_at: test.authorization.expires_at ?? "2026-09-20T00:00:00Z",
    status: test.authorization.status ?? "pending"
  });

  let rejected = false;
  try { validate(candidate); } catch { rejected = true; }
  if (test.expected === "reject" && !rejected) throw new Error("negative case was accepted: " + test.name);
}

console.log("living identity fixture: PASS");
console.log("living identity negative fixtures: PASS");
