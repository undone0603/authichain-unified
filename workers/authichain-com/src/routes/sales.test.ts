import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../index.ts";
import { answerSalesInquiry } from "../../../../src/lib/sales-reply.ts";

type Env = Parameters<typeof worker.fetch>[1];

const ENV = {
  APP_WORKER: { fetch: async () => new Response("app", { status: 200 }) },
} as unknown as Env;

function post(body: unknown) {
  return worker.fetch(
    new Request("https://authichain.com/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    ENV
  );
}

test("purchase intent returns the gated DPP checkout, not an audit link", async () => {
  const answer = answerSalesInquiry("I want to buy the battery passport");
  assert.equal(answer.intent, "purchase");
  assert.equal(answer.plan, "dpp_readiness");
  assert.match(
    answer.checkout_url ?? "",
    /^https:\/\/authichain\.com\/checkout\/dpp_readiness\?/
  );
  assert.match(answer.checkout_url ?? "", /utm_campaign=battery-passport/);
  assert.doesNotMatch(answer.reply, /Readiness Audit/);
  assert.match(answer.reply, /not an audit/i);
  assert.equal(answer.reply.includes("buy.stripe.com"), false);
  assert.equal(answer.reply.includes("/battery-passport)"), false);
});

test("a named public plan stays on that plan", () => {
  const answer = answerSalesInquiry("checkout starter");
  assert.equal(answer.plan, "starter");
  assert.match(
    answer.checkout_url ?? "",
    /^https:\/\/authichain\.com\/checkout\/starter\?/
  );
});

test("farm and theater are not given a checkout URL", () => {
  for (const text of ["buy strainchain_farm", "upgrade theater_3", "checkout farm"]) {
    const answer = answerSalesInquiry(text);
    assert.equal(answer.intent, "refused_private_plan", text);
    assert.equal(answer.checkout_url, null, text);
  }
});

test("verify wording points at the open verifier and is not a verdict", () => {
  const answer = answerSalesInquiry("verify polygon-anchor-1");
  assert.equal(answer.intent, "verify");
  assert.equal(
    answer.verify_url,
    "https://authichain.com/api/verify?id=polygon-anchor-1"
  );
  assert.match(answer.reply, /not a verdict/i);
  assert.equal(answer.checkout_url, null);
});

test("POST /api/sales answers from the catalogue and does not call a model", async () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "sales.ts"),
    "utf8"
  );
  assert.equal(source.includes("@anthropic-ai"), false);
  assert.equal(source.includes("ANTHROPIC"), false);

  const res = await post({
    messages: [{ role: "user", content: "I want to purchase dpp_readiness" }],
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.plan, "dpp_readiness");
  assert.match(body.checkout_url, /\/checkout\/dpp_readiness/);
  assert.equal(JSON.stringify(body).includes("buy.stripe.com"), false);
});

test("GET /api/sales is not allowed", async () => {
  const res = await worker.fetch(
    new Request("https://authichain.com/api/sales"),
    ENV
  );
  assert.equal(res.status, 405);
});

test("malformed and empty sales bodies are rejected", async () => {
  const malformed = await worker.fetch(
    new Request("https://authichain.com/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
    ENV
  );
  assert.equal(malformed.status, 400);
  const empty = await post({ message: "   " });
  assert.equal(empty.status, 400);
});
