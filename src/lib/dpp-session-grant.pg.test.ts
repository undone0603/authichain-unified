/** Isolated PGlite verification of the committed DPP grant SQL. No production access. */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const MIGRATION = "supabase/migrations/20261112195000_dpp_legacy_grant_marker_guard.sql";
let db: PGlite;

async function grant(profile: string, session: string) {
  const result = await db.query<{ result: { status: string; profile_id?: string } }>(
    "SELECT public.grant_dpp_checkout_session($1, $2, 'authichain', NULL) AS result",
    [profile, session],
  );
  return result.rows[0].result;
}

async function limit(profile: string) {
  const result = await db.query<{ generations_limit: number; last_grant_session_id: string | null }>(
    "SELECT generations_limit, last_grant_session_id FROM public.profiles WHERE id::text = $1",
    [profile],
  );
  return result.rows[0];
}

describe("DPP atomic grant isolated PostgreSQL replay", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE TABLE public.profiles (
        id uuid PRIMARY KEY, brand text, subscription_plan text,
        subscription_status text, last_payment_at timestamptz,
        stripe_customer_id text, stripe_subscription_id text,
        generations_limit integer, generations_used integer,
        last_grant_session_id text
      );
      CREATE TABLE public.founder_exit_side_effects (
        idempotency_key text PRIMARY KEY, profile_id text
      );
      DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await db.exec(readFileSync(MIGRATION, "utf8"));
    await db.query("INSERT INTO public.profiles(id,generations_limit,generations_used) VALUES ($1::uuid, 100, 0),($2::uuid, 0, 0)", [A,B]);
  }, 120_000);
  afterAll(async () => { if (db) await db.close(); });

  it("one grant, exact replay, and replay after a different grant never double-credit", async () => {
    expect((await grant(A, "cs_dpp_a")).status).toBe("granted");
    expect((await limit(A)).generations_limit).toBe(150);
    expect((await grant(A, "cs_dpp_a")).status).toBe("already_granted");
    expect((await limit(A)).generations_limit).toBe(150);
    expect((await grant(A, "cs_dpp_b")).status).toBe("granted");
    expect((await limit(A)).generations_limit).toBe(200);
    expect((await grant(A, "cs_dpp_a")).status).toBe("already_granted");
    expect(await limit(A)).toMatchObject({ generations_limit: 200, last_grant_session_id: "cs_dpp_b" });
  });

  it("a receipt cannot be transferred to another profile", async () => {
    const replay = await grant(B, "cs_dpp_a");
    expect(replay).toMatchObject({ status: "already_granted", profile_id: A });
    expect((await limit(B)).generations_limit).toBe(0);
  });

  it("documents that SQL receipt idempotency is not Stripe settlement proof", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    expect(sql).toContain("grant_dpp_checkout_session");
    expect(sql).not.toMatch(/p_payment_intent|p_amount_paid|p_payment_verified/);
    // This is an explicit outstanding security boundary, NOT a paid-settlement acceptance test.
  });

  it("pins the cluster-identity RPC to service_role and read-only pg_control_system", () => {
    const migration = readFileSync(
      "supabase/migrations/20261116153000_runtime_database_identity_attestation.sql",
      "utf8",
    );
    expect(migration).toContain("system_identifier::text");
    expect(migration).toContain("pg_catalog.pg_control_system()");
    expect(migration).toContain("pg_catalog.current_database()");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("REVOKE ALL");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("TO service_role");
    const functionBody = migration.split("AS $")[1]?.split("$;")[0] ?? "";
    expect(functionBody).not.toContain("auth.instances");
  });

});
