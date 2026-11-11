import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../../workers/authichain-automation/index.js",import.meta.url),"utf8");
const wrangler=fs.readFileSync(new URL("../../workers/authichain-automation/wrangler.toml",import.meta.url),"utf8");

test("existing schedule is unchanged and still logs",()=>{
 assert.match(source,/Cron trigger fired at:/);
 assert.match(source,/event\.cron !== "14 \* \* \* \*"/);
 assert.match(source,/ctx\.waitUntil\(/);
});
test("AgentZ dispatch failure remains visible to the scheduler runtime",()=>{
 assert.match(source,/try \{/);
 assert.match(source,/catch \(error\) \{/);
 assert.match(source,/AgentZ dispatch unavailable/);
 assert.match(source,/if \(!response\.ok\) throw new Error/);
 assert.match(source,/throw error/);
});
test("private service binding and distinct token",()=>{
 assert.match(wrangler,/binding = "AGENTZ_EDGE"/);
 assert.match(wrangler,/service = "authichain-agentz-mcp-edge"/);
 assert.match(source,/env\.AGENTZ_DISPATCH_TOKEN/);
 assert.doesNotMatch(source,/env\.AGENTZ_MCP_TOKEN/);
 assert.match(wrangler,/workers_dev = false/);
});
test("does not alter billing, payment or existing route handlers",()=>{
 assert.match(source,/handleStripeWebhook/);
 assert.match(source,/handleRequest\(request, env\)/);
});
