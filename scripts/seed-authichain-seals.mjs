#!/usr/bin/env node
// Seed AuthiChain-owned signed seals via POST /protocol/seal-sign.
// The worker signs with its own Ed25519 key and writes auth_seals; this
// script never sees the key. Auth: SEAL_SIGN_BEARER = a GitHub OIDC token
// (workflow) or the one-time SEAL_SEED_TOKEN (local wrangler path).
// Run ONCE: each call appends a new seal row.
import { readFileSync } from "node:fs";

const base = process.env.SEAL_SIGN_BASE || "https://authichain.com";
const bearer = process.env.SEAL_SIGN_BEARER;
if (!bearer) {
  console.error("SEAL_SIGN_BEARER is required");
  process.exit(2);
}
const seeds = JSON.parse(readFileSync(new URL("./seed-authichain-seals.json", import.meta.url), "utf8"));
let failed = 0;
for (const seed of seeds) {
  const res = await fetch(`${base}/protocol/seal-sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
    body: JSON.stringify(seed),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status !== 201) {
    failed++;
    console.error(`FAIL ${seed.product_id}: ${res.status} ${body.error ?? ""}`);
    continue;
  }
  console.log(`OK ${seed.product_id} seal_id=${body.seal_id} kid=${body.kid} verify=${body.verify}`);
}
process.exit(failed ? 1 : 0);
