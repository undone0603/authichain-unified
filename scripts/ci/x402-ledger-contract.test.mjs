import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fromRepo = relative => readFileSync(new URL("../../" + relative, import.meta.url), "utf8");
const migration = fromRepo("supabase/migrations/20261108215700_x402_agent_pack_credits.sql");
const edge = fromRepo("worker-app/wrangler.toml");
const apex = fromRepo("workers/authichain-com/wrangler.toml");

function rpc(name) {
  const pattern = new RegExp(
    "create or replace function public\\." + name +
    "\\([\\s\\S]*?\\) returns (?:text|boolean|jsonb)[\\s\\S]*?end\\n\\$\\$;",
    "i"
  );
  const found = migration.match(pattern);
  assert.ok(found, "missing expected RPC: " + name);
  return found[0];
}

test("three separate prepaid tables are inaccessible to public callers", () => {
  for (const name of ["grants", "spends", "reversals"]) {
    const table = "x402_agent_pack_" + name;
    assert.match(migration, new RegExp("create table if not exists public\\." + table));
    assert.match(migration, new RegExp("alter table public\\." + table + " enable row level security"));
    assert.match(migration, new RegExp("revoke all on public\\." + table + " from public, anon, authenticated"));
  }
  // Protect against accidentally exposing prepaid grant or spend tables via
  // an added RLS policy. A regex literal needs \s (not \\s): the old form
  // matched only literal backslash, s and S characters and missed real SQL.
  const exposedLedgerPolicy = /\bcreate\s+policy\b[\s\S]*?\bon\s+(?:public\.)?x402_agent_pack_(?:grants|spends|reversals)\b/i;
  assert.doesNotMatch(migration, exposedLedgerPolicy);
  for (const table of ["grants", "spends", "reversals"]) {
    const deliberatelyExposed = migration + "\nCREATE POLICY allow_everyone ON public.x402_agent_pack_" +
      table + " FOR SELECT TO authenticated USING (true);";
    assert.match(deliberatelyExposed, exposedLedgerPolicy,
      "negative-case test must detect a real public RLS policy on " + table);
  }
});

test("grant is pinned to a paid live Stripe session and unique PaymentIntent", () => {
  const grant = rpc("grant_x402_agent_pack");
  assert.match(grant, /p_checkout_session_id !~ '\^cs_live_'/);
  assert.match(grant, /p_payment_intent_id !~ '\^pi_'/);
  assert.match(grant, /on conflict \(checkout_session_id\) do nothing/);
  assert.match(migration, /create unique index if not exists x402_agent_pack_grants_payment_intent_idx/);
  assert.match(migration, /price_id text not null check \(price_id = 'price_1UZdq5GqTruSqV8TsaDtFBPF'\)/);
  assert.match(migration, /credits_total integer not null default 120 check \(credits_total = 120\)/);
});

test("paid grant and reversal serialize on PaymentIntent and refuse delayed grant", () => {
  const grant = rpc("grant_x402_agent_pack");
  const reversal = rpc("reverse_x402_agent_pack");
  assert.match(grant, /hashtextextended\(p_payment_intent_id, 0\)/);
  assert.match(reversal, /hashtextextended\(p_payment_intent_id, 0\)/);
  assert.ok(grant.indexOf("x402_agent_pack_reversals") < grant.indexOf("insert into public.x402_agent_pack_grants"));
  assert.match(reversal, /insert into public\.x402_agent_pack_reversals/);
  assert.match(reversal, /update public\.x402_agent_pack_grants/);
});

test("refunds serialize with spending and idempotent replays using the buyer lock", () => {
  const spend = rpc("consume_x402_agent_pack_credit");
  const reversal = rpc("reverse_x402_agent_pack");
  assert.match(spend, /hashtextextended\(v_email, 0\)/);
  assert.match(reversal, /hashtextextended\(v_buyer_email, 0\)/);
  assert.ok(
    reversal.indexOf("hashtextextended(p_payment_intent_id, 0)") <
    reversal.indexOf("hashtextextended(v_buyer_email, 0)")
  );
  assert.match(spend, /'replayed', true,[\s\S]*?'remaining_credits', v_remaining/);
});

test("redemption checks active API key before debit and cannot overspend", () => {
  const spend = rpc("consume_x402_agent_pack_credit");
  assert.match(spend, /from public\.api_keys k/);
  assert.match(spend, /k\.is_active is true/);
  assert.match(spend, /credits_used < credits_total/);
  assert.match(spend, /update public\.x402_agent_pack_grants[\s\S]*?credits_used = credits_used \+ 1/);
  assert.match(migration, /primary key \(api_key_id, idempotency_key\)/);
  assert.match(migration, /check \(credits_used >= 0 and credits_used <= credits_total\)/);
});

test("all three functions have correctly paired PL/pgSQL dollar-quoted bodies", () => {
  assert.doesNotMatch(migration, /^as \$(?!\$)/m, "one-dollar AS is a fatal SQL syntax error");
  const starts = [...migration.matchAll(/^as \$\$$/gm)];
  const ends = [...migration.matchAll(/^\$\$;$/gm)];
  assert.equal(starts.length, 3, "expected 3 function AS $$ delimiters");
  assert.equal(ends.length, 3, "expected 3 matching closing $$ delimiters");
  for (const fn of ["consume_x402_agent_pack_credit", "grant_x402_agent_pack", "reverse_x402_agent_pack"]) {
    const body = rpc(fn);
    assert.match(body, /^as \$\$$/m);
    assert.match(body, /^\$\$;$/m);
  }
});

test("all three RPCs are service-role-only and invoker security", () => {
  for (const fn of ["consume_x402_agent_pack_credit", "grant_x402_agent_pack", "reverse_x402_agent_pack"]) {
    assert.match(rpc(fn), /language plpgsql security invoker set search_path = ''/);
    assert.match(migration, new RegExp("revoke all on function public\\." + fn + "[\\s\\S]*?from public, anon, authenticated"));
    assert.match(migration, new RegExp("grant execute on function public\\." + fn + "[\\s\\S]*?to service_role"));
  }
});

test("neither Worker can sell prepaid credits until approved enabled config is promoted", () => {
  for (const vars of [edge, apex]) {
    assert.match(vars, /^X402_PACK_PRICE_ID = "price_1UZdq5GqTruSqV8TsaDtFBPF"$/m);
    assert.match(vars, /^X402_PACK_CREDITS = "120"$/m);
    assert.match(vars, /^X402_PACK_ENABLED = "false"$/m);
  }
});
