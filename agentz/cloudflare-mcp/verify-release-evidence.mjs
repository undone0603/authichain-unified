#!/usr/bin/env node
// Read-only, machine-verifiable release evidence checker.
// Usage: node agentz/cloudflare-mcp/verify-release-evidence.mjs evidence.json
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
const file=process.argv[2];
if(!file)throw Error("Usage: verify-release-evidence.mjs <evidence.json>");
const e=JSON.parse(readFileSync(file,"utf8"));
const sha=/^[a-f0-9]{40}$/;
assert.match(e.source_sha,sha,"source SHA");
assert.match(e.deployed_sha,sha,"deployed SHA");
assert.equal(e.source_sha,e.deployed_sha,"deployed source must match tested SHA");
assert.ok(!Number.isNaN(Date.parse(e.deployed_at)),"deployment timestamp");
assert.ok(!Number.isNaN(Date.parse(e.scheduled_at)),"scheduled invocation timestamp");
assert.ok(Date.parse(e.scheduled_at)>=Date.parse(e.deployed_at),"invocation must follow deployment");
assert.equal(e.cron,"14 * * * *","preserved schedule");
assert.ok(typeof e.task_id==="string"&&e.task_id.length>0,"task ID");
assert.ok(Number.isSafeInteger(e.event_id)&&e.event_id>0,"event ID");
assert.ok(Number.isSafeInteger(e.learning_id)&&e.learning_id>0,"learning ID");
assert.equal(e.task_status,"succeeded");
assert.equal(e.event_task_id,e.task_id,"event must reference task");
assert.equal(e.learning_source_event_id,e.event_id,"learning must reference event");
assert.equal(e.event_outcome,"success");
assert.equal(e.learning_outcome,"success");
assert.ok(/^https:\/\/github\.com\/undone0603\/authichain-unified(?:\/|$)/.test(e.evidence_url),"allowlisted evidence URL");
assert.equal(e.tests?.integration?.status,"success","passing integration");
assert.equal(e.tests?.integration?.sha,e.source_sha,"integration SHA");
assert.ok(typeof e.tests.integration.url==="string"&&e.tests.integration.url.startsWith("https://"),"test link");
assert.equal(e.tests?.scheduler?.status,"success","scheduler verification");
console.log(JSON.stringify({verified:true,sha:e.source_sha,task_id:e.task_id,event_id:e.event_id,learning_id:e.learning_id}));
