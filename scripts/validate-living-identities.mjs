import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = "docs/living-identities";
const fixture = JSON.parse(await readFile(join(root, "example.identity.json"), "utf8"));

if (fixture.schema_version !== "living-identity.v0.1") throw new Error("bad schema version");
if (fixture.identity?.status !== "living_person") throw new Error("identity must be a living person");
if (!fixture.identity?.identity_id?.startsWith("person:")) throw new Error("invalid person identity id");
if (!fixture.claims?.length || !fixture.sources?.length) throw new Error("missing claims or sources");

const sourceIds = new Set(fixture.sources.map(s => s.source_id));
for (const claim of fixture.claims) {
  if (claim.state === "self_attested" && !claim.source_ids?.length) throw new Error("self-attested claim lacks attestation source");
  if (claim.source_ids?.some(id => !sourceIds.has(id))) throw new Error("claim references unknown source");
  if (claim.sensitive === true) throw new Error("sensitive personal data must be excluded from the public fixture");
  if (["trust_score","morality_score","credibility_score","political_score","social_worth_score"].includes(claim.predicate)) throw new Error("person-level evaluative score is prohibited");
}

for (const auth of fixture.authorizations ?? []) {
  if (!auth.authorization_id || auth.status === "active" && !auth.expires_at) throw new Error("active authorization requires expiry");
  if (auth.principal_identity_id !== fixture.identity.identity_id) throw new Error("authorization principal mismatch");
  if (auth.capabilities.includes("impersonate_human")) throw new Error("human impersonation capability is prohibited");
}

console.log("living identity fixture: PASS");
