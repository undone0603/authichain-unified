import { pathToFileURL } from "node:url";
import { LOOKUPS, validPrice } from "../src/index.ts";

/** Run only in a host that already has the approved key in its environment. */
export async function bindSecrets(env, { fetch: request = globalThis.fetch, apply = false, log = console.log } = {}) {
  const mode = env.STRIPE_MODE ?? "live";
  if (!new RegExp(`^(sk|rk)_${mode}_`).test(env.STRIPE_SECRET_KEY ?? "") || !env.CLOUDFLARE_API_TOKEN || !/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID ?? "")) throw new Error("Required secure environment bindings are missing");
  const base = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/license-checkout`;
  const cfHeaders = { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" };
  const existing = await request(`${base}/settings`, { headers: cfHeaders, redirect: "error" });
  if (!existing.ok || !(await existing.json()).success) throw new Error("license-checkout Worker must exist before secrets can be bound");
  const query = new URLSearchParams({ limit: "10" });
  for (const lookup of Object.values(LOOKUPS)) query.append("lookup_keys[]", lookup);
  const response = await request(`https://api.stripe.com/v1/prices?${query}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Stripe-Version": "2026-08-26.dahlia" }, redirect: "error",
  });
  if (!response.ok) throw new Error("Stripe price lookup failed");
  const catalog = await response.json();
  if (catalog.has_more !== false || !Array.isArray(catalog.data)) throw new Error("Incomplete price lookup");
  const bindings = [{ name: "STRIPE_SECRET_KEY", text: env.STRIPE_SECRET_KEY }];
  for (const [name, lookup] of Object.entries(LOOKUPS)) {
    const matches = catalog.data.filter(price => price.lookup_key === lookup);
    if (matches.length !== 1 || !validPrice(matches[0], name, mode === "live")) throw new Error(`Price validation failed for ${name}`);
    bindings.push({ name, text: matches[0].id });
  }
  for (const binding of bindings) {
    if (apply) {
      const result = await request(`${base}/secrets`, { method: "PUT", headers: cfHeaders, redirect: "error", body: JSON.stringify({ ...binding, type: "secret_text" }) });
      if (!result.ok || !(await result.json()).success) throw new Error(`Secret bind failed for ${binding.name}`);
    }
    log(`${apply ? "bound" : "validated"} ${binding.name}`);
  }
  return { applied: apply, names: bindings.map(binding => binding.name) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  bindSecrets(process.env, { apply: process.argv.includes("--apply") }).catch(error => {
    // Errors name the operation; provider payloads and credential values are never printed.
    console.error(error.message); process.exitCode = 1;
  });
}
