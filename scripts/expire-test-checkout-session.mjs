import { argv, env, exit } from "node:process";

const sessionId =
  argv[2] ?? "cs_test_a1BFSSy4SzDUjlCTiw9OhaiJjhDloIsVpk80TZDlpSkA8qee5dA57DyV9k";
const key = env.STRIPE_SECRET_KEY ?? "";

if (!sessionId.startsWith("cs_test_")) {
  console.error(JSON.stringify({ event: "expire_refused", reason: "not_test_session" }));
  exit(1);
}
if (!key.startsWith("sk_test_")) {
  console.error(JSON.stringify({ event: "expire_refused", reason: "not_test_key" }));
  exit(1);
}

const res = await fetch(
  `https://api.stripe.com/v1/checkout/sessions/${sessionId}/expire`,
  { method: "POST", headers: { Authorization: `Bearer ${key}` } },
);
const body = await res.json();
console.log(JSON.stringify({
  event: res.ok ? "checkout_session_expired" : "expire_failed",
  id: body.id ?? sessionId,
  status: body.status ?? null,
  payment_status: body.payment_status ?? null,
  livemode: body.livemode ?? null,
  amount_total: body.amount_total ?? null,
  http: res.status,
}));
if (!res.ok || body.status !== "expired" || body.livemode !== false) exit(1);
