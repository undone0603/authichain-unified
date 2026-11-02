/**
 * Zero-dependency, source-level DPP route smoke tests.
 *
 * Node >=22.16, no credentials or network. Runs the actual TS route source
 * after Node strips its types in a bounded VM with only Fetch/URL primitives.
 * The plan catalog is replaced by a small fixture because this check targets
 * receipt copy and URL safety, not paid fulfillment.
 *
 * node --test workers/authichain-com/dpp-routes.offline.test.mjs
 *
 * This is supplemental: it does not replace Vitest, build, integration tests,
 * review, or deployment verification.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

const source = readFileSync(new URL("./src/dpp-routes.ts", import.meta.url), "utf8");
const planImport = /^import \{ PLANS \} from "\.\.\/\.\.\/\.\.\/src\/lib\/plans";\s*$/m;
assert.match(source, planImport, "Expected fixed plan-catalog import; inspect source changes");
assert.match(source, /export function tryHandleDppRoute\(/);

const withFixture = source.replace(
  planImport,
  'const PLANS = Object.freeze([{ id: "qron_launch", name: "QRON Launch", credits: 50 }]);'
);
const runnable = stripTypeScriptTypes(withFixture, { mode: "strip" })
  .replace(/^export\s+(?=function|const)/gm, "");
const sandbox = vm.createContext({
  URL, URLSearchParams, Request, Response, TextEncoder,
});
vm.runInContext(runnable + "\nthis.testRoute = tryHandleDppRoute;", sandbox, {
  timeout: 1500,
  filename: "dpp-routes.offline.ts",
});

const route = sandbox.testRoute;
assert.equal(typeof route, "function");

function req(path, init) {
  return new Request("https://authichain.example" + path, init);
}

async function get(path, init) {
  const result = route(req(path, init));
  assert.ok(result, "Expected DPP route response");
  return { result, html: await result.text() };
}

test("missing checkout ID is not described as paid on every thanks alias", async () => {
  for (const path of ["/dpp/thanks", "/thanks", "/success"]) {
    const { html } = await get(path);
    assert.match(html, /Payment not verified/);
    assert.doesNotMatch(html, /Payment received|Workspace opened/);
    assert.doesNotMatch(html, /\/dpp\/activate\?session_id=/);
  }
});

test("malformed checkout ID never shows paid receipt", async () => {
  for (const id of ["garbage", "cs_live_", "cs_test_abc%3Cscript%3E"]) {
    const { html } = await get("/dpp/thanks?session_id=" + id);
    assert.match(html, /Payment not verified/);
  }
});

test("valid-format checkout ID remains neutral until payment is checked", async () => {
  const { html } = await get("/dpp/thanks?session_id=cs_test_123&visit_id=abc");
  assert.match(html, /Check your workspace activation/);
  assert.match(html, /does not establish that payment succeeded/);
  assert.doesNotMatch(html, /Payment received|Workspace opened/);
  assert.match(html, /\/dpp\/activate\?session_id=cs_test_123/);
});

test("checkout URL data is encoded in the neutral activation link", async () => {
  const { html } = await get("/dpp/thanks?session_id=cs_test_123&visit_id=a%20b");
  assert.match(html, /visit_id=a\+b|visit_id=a%20b/);
});

test("non-DPP plan cannot display DPP payment/credit success", async () => {
  for (const plan of ["qron_launch", "starter", "arbitrary_plan"]) {
    const { html } = await get("/dpp/thanks?session_id=cs_test_123&plan=" + plan);
    assert.match(html, /Check your payment status/);
    assert.doesNotMatch(html, /Payment received|Workspace opened|credits granted/i);
  }
});

test("missing and malformed IDs do not reveal activation form", async () => {
  for (const id of ["", "invalid", "%3Cscript%3E"]) {
    const { html } = await get("/dpp/activate?session_id=" + id);
    assert.match(html, /Missing checkout session/);
    assert.doesNotMatch(html, /id="f"|<form/);
  }
});

test("script-breaking visitor ID is escaped before insertion into inline code", async () => {
  const payload = "</script><script>window.pwned=1</script>";
  const { html } = await get("/dpp/activate?session_id=cs_test_123&visit_id=" + encodeURIComponent(payload));
  assert.match(html, /Activate your workspace/);
  assert.doesNotMatch(html, /<script>window\.pwned=1<\/script>/);
  assert.match(html, /\\u003c\/script>/);
});

test("DPP HTML responses cannot be cached as payment evidence", async () => {
  const { result } = await get("/dpp/thanks");
  assert.match(result.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(result.headers.get("x-content-type-options"), "nosniff");
});

test("DPP marketing, Stripe webhook and activation POST fall through", () => {
  assert.equal(route(req("/dpp")), null);
  assert.equal(route(req("/api/stripe/webhook", { method: "POST" })), null);
  assert.equal(route(req("/api/dpp/activate", { method: "POST" })), null);
});
