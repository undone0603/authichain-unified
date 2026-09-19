/**
 * Guard the credentials.get() env mapping so a rename cannot silently
 * starve the FastAPI process of AGENT_SECRET / SUPABASE_*.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AGENTZ_API_ENTRYPOINT, containerEnvFromBindings } from "./env.ts";

test("forwards AGENT_SECRET and SUPABASE_URL unchanged", () => {
  const env = containerEnvFromBindings({
    AGENT_SECRET: "s",
    SUPABASE_URL: "https://example.supabase.co",
  });
  assert.equal(env.AGENT_SECRET, "s");
  assert.equal(env.SUPABASE_URL, "https://example.supabase.co");
});

test("SUPABASE_SERVICE_KEY alias becomes SUPABASE_SERVICE_ROLE_KEY", () => {
  const env = containerEnvFromBindings({
    SUPABASE_SERVICE_KEY: "role-from-alias",
  });
  assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, "role-from-alias");
  assert.equal(env.SUPABASE_SERVICE_KEY, "role-from-alias");
});

test("SUPABASE_SERVICE_ROLE_KEY wins over the alias", () => {
  const env = containerEnvFromBindings({
    SUPABASE_SERVICE_ROLE_KEY: "canonical",
    SUPABASE_SERVICE_KEY: "alias",
  });
  assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, "canonical");
});

test("omits unset secrets so placeholders are not invented", () => {
  const env = containerEnvFromBindings({});
  assert.deepEqual(env, {});
});

test("API entrypoint is uvicorn on the Dockerfile.agentz image", () => {
  assert.deepEqual(
    [...AGENTZ_API_ENTRYPOINT],
    ["uvicorn", "agentz.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
  );
  const wrangler = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "wrangler.jsonc"),
    "utf8"
  );
  assert.match(wrangler, /"image":\s*"\.\.\/\.\.\/Dockerfile\.agentz"/);
  assert.match(wrangler, /"image_build_context":\s*"\.\.\/\.\."/);
});
