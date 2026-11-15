import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const workflow=readFileSync(".github/workflows/deploy-authichain-app.yml","utf8");
const database=readFileSync("scripts/ci/verify-dpp-outbox-production.sh","utf8");

test("root-app release is protected by exact-main quality and database attestation",()=>{
  for(const marker of [
    "needs: [preflight, db_preflight]",
    "name: production-cloudflare",
    "name: production-supabase",
    "node scripts/ci/autonomous-release-gate.mjs",
    "node scripts/ci/verify-dpp-release-env.mjs",
    "Main quality gate",
    "bash scripts/ci/verify-dpp-outbox-production.sh",
    'test "$EXPECTED_SHA" = "$DISPATCH_SHA"',
    "current main does not equal exact release SHA",
    "needs.db_preflight.result == 'success'",
    "needs.db_preflight.result == 'skipped'"
  ])assert.ok(workflow.includes(marker),"missing release marker: "+marker);
  assert.ok(!workflow.includes("secrets.CLOUDFLARE_API_TOKEN"));
});
test("DPP schema attestation uses read-only SQL, target identity, and all service privileges",()=>{
  for(const marker of [
    "default_transaction_read_only=on",
    "20261112213000",
    "AUTHICHAIN_PRODUCTION_SUPABASE_PROJECT_REF",
    "EXPECTED_SUPABASE_REF",
    "relrowsecurity",
    "has_function_privilege",
    "'SELECT')",
    "'INSERT')",
    "'UPDATE')",
    "DPP_ACTIVATION_DB_READY"
  ])assert.ok(database.includes(marker),"missing database attestation: "+marker);
  assert.ok(!database.includes("supabase db push"));
  assert.ok(!database.includes("psql -f"));
});

test("root application Hyperdrive target must be attested before publish",()=>{
  const verifier=readFileSync("scripts/ci/verify-root-app-hyperdrive-target.mjs","utf8");
  assert.ok(workflow.includes("node scripts/ci/verify-root-app-hyperdrive-target.mjs"));
  assert.ok(workflow.indexOf("node scripts/ci/verify-root-app-hyperdrive-target.mjs")<workflow.indexOf("name: Publish authichain-app"));
  for(const marker of ["workers/scripts/authichain-app/settings","hyperdrive/configs/","postgres.","ROOT_APP_HYPERDRIVE_TARGET_MATCH","release held"]){
    assert.ok(verifier.includes(marker),"missing root-app target assertion: "+marker);
  }
});
