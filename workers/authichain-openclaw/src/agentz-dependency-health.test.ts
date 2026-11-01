import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAgentzDependency } from "./agentz-dependency-health.ts";

const env = {
  AGENTZ_API_URL: "https://agentz.authichain.com",
  AGENTZ_API_KEY: "agentz-bearer",
  CF_ACCESS_CLIENT_ID: "machine",
  CF_ACCESS_CLIENT_SECRET: "service-secret",
};

test("does not make a network call if any required secret is absent", async () => {
  for (const name of Object.keys(env)) {
    const missing = {...env, [name]: ""};
    const out = await checkAgentzDependency(missing, async () => {
      throw new Error("network should not be called");
    });
    assert.equal(out.state, "not_configured");
  }
});

test("rejects untrusted origin before attaching any credential", async () => {
  const result = await checkAgentzDependency({
    ...env, AGENTZ_API_URL: "https://untrusted.example",
  }, async () => {
    throw new Error("must not transmit keys");
  });
  assert.equal(result.state, "origin_mismatch");
});

test("uses the existing Access pair and bearer only against exact AgentZ health path", async () => {
  let calls = 0;
  const result = await checkAgentzDependency(env, async (url, options) => {
    calls++;
    assert.equal(url, "https://agentz.authichain.com/health");
    assert.equal(options?.method, "GET");
    assert.equal(options?.redirect, "manual");
    assert.equal(new Headers(options?.headers).get("CF-Access-Client-Id"), "machine");
    assert.equal(new Headers(options?.headers).get("CF-Access-Client-Secret"), "service-secret");
    assert.equal(new Headers(options?.headers).get("Authorization"), "Bearer agentz-bearer");
    return new Response(JSON.stringify({status:"sovereign",network:"Polygon"}),{
      status:200,headers:{"content-type":"application/json"},
    });
  });
  assert.equal(calls,1);
  assert.deepEqual(result,{service:"agentz",state:"healthy",upstream_status:200});
});

test("fails on Cloudflare Access redirects, wrong shape, HTTP 503, network timeout", async () => {
  for (const [response, expected] of [
    [new Response("",{status:302,headers:{location:"https://access.example/"}}),"access_denied"],
    [new Response("<html>ok</html>",{status:200}),"upstream_unhealthy"],
    [new Response(JSON.stringify({status:"not ready"}),{status:200}),"upstream_unhealthy"],
    [new Response("",{status:503}),"upstream_unhealthy"],
  ] as const) {
    const out = await checkAgentzDependency(env,async () => response);
    assert.equal(out.state,expected);
  }
  assert.equal((await checkAgentzDependency(env,async () => {
    throw Error("network unavailable");
  })).state,"upstream_unhealthy");
});

test("never exposes the upstream error response or credentials in results", async () => {
  const out = await checkAgentzDependency(env,async () =>
    new Response("Authorization: Bearer sensitive", {status:502}));
  assert.equal(JSON.stringify(out).includes("sensitive"),false);
  assert.equal(JSON.stringify(out).includes("service-secret"),false);
});
