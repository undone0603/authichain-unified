import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/deploy-authichain-app.yml", "utf8");
const database = readFileSync("scripts/ci/verify-dpp-outbox-production.sh", "utf8");

test("root-app release is protected by exact-main quality and database attestation", () => {
  for (const marker of [
    "needs: [preflight, db_preflight]",
    "name: production-cloudflare",
    "name: production-supabase",
    "node scripts/ci/autonomous-release-gate.mjs",
    "node scripts/ci/verify-dpp-release-env.mjs",
    "node scripts/ci/verify-dpp-main-quality.mjs",
    "node scripts/ci/worker-release-receipt.mjs before",
    "node scripts/ci/worker-release-receipt.mjs after",
    "--outdir .release-receipt/bundle",
    "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9",
    "if-no-files-found: error",
    "bash scripts/ci/verify-dpp-outbox-production.sh",
    'test "$EXPECTED_SHA" = "$DISPATCH_SHA"',
    "current main does not equal exact release SHA",
    "needs.db_preflight.result == 'success'",
    "needs.db_preflight.result == 'skipped'",
  ]) assert.ok(workflow.includes(marker), "missing release marker: " + marker);
  assert.ok(!workflow.includes("secrets.CLOUDFLARE_API_TOKEN"));
  assert.ok(workflow.includes("release_mode:"));
  assert.ok(workflow.includes("inputs.release_mode == 'attestation-bootstrap'"));
  assert.ok(workflow.includes("inputs.release_mode == 'dpp-email'"));
  assert.ok(workflow.includes("verify-runtime-attestation-production.sh"));
  assert.ok(workflow.includes("scripts/ci/verify-dpp-main-quality.test.mjs"));
  assert.ok(!workflow.includes("Require successful exact-head GitHub Main quality gate"));
  assert.ok(!workflow.includes("run.name===\"Main quality gate\""));
});

test("DPP schema gate validates current RPC-only outbox, target identity, and read-only access", () => {
  for (const marker of [
    "default_transaction_read_only=on",
    "20261119133000",
    "dpp_activation_outbox",
    "AUTHICHAIN_PRODUCTION_SUPABASE_PROJECT_REF",
    "EXPECTED_SUPABASE_REF",
    "relrowsecurity",
    "has_function_privilege",
    "has_table_privilege",
    "service_role",
    "anon",
    "authenticated",
    "'SELECT, INSERT, UPDATE, DELETE'",
    "DPP_ACTIVATION_DB_READY",
    "dpp_activation_prepare(text)",
    "dpp_activation_enqueue(text,text,boolean)",
    "dpp_activation_claim(text,text)",
    "dpp_activation_begin_send(text,uuid)",
    "dpp_activation_finish_send(text,uuid,boolean,text,integer,text)",
  ]) assert.ok(database.includes(marker), "missing database attestation: " + marker);
  assert.ok(!database.includes("to_regclass('public.dpp_activation_email_delivery')"), "obsolete outbox table check");
  assert.ok(!database.includes("to_regprocedure('public.claim_dpp_activation_email"), "obsolete claim RPC");
  assert.ok(!database.includes("supabase db push"));
  assert.ok(!database.includes("psql -f"));
});
