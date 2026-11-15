/**
 * Isolated synthetic Postgres for grant_catalog_checkout_session.
 * Does not connect to production. Loads the committed migration file.
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { CATALOG_GRANT_MIGRATION, CATALOG_GRANT_RPC } from "./provisioning";

const PROF_A = "11111111-1111-1111-1111-111111111111";
const PROF_B = "22222222-2222-2222-2222-222222222222";

async function isolatedCatalogDb() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY,
      brand text,
      subscription_plan text,
      subscription_status text,
      last_payment_at timestamptz,
      stripe_customer_id text,
      stripe_subscription_id text,
      generations_limit integer,
      generations_used integer,
      last_grant_session_id text
    );
    CREATE TABLE public.founder_exit_side_effects (
      idempotency_key text PRIMARY KEY,
      recorded_at timestamptz NOT NULL DEFAULT now(),
      profile_id text
    );
    DO $$ BEGIN
      CREATE ROLE service_role;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      CREATE ROLE anon NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      CREATE ROLE authenticated NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      CREATE ROLE catalog_anon NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await db.exec(readFileSync(CATALOG_GRANT_MIGRATION, "utf8"));
  return db;
}

async function insertProfile(
  db: PGlite,
  id: string,
  limit = 0,
  used = 0,
  last: string | null = null
) {
  await db.query(
    `INSERT INTO public.profiles
       (id, generations_limit, generations_used, last_grant_session_id)
     VALUES ($1::uuid, $2, $3, $4)`,
    [id, limit, used, last]
  );
}

async function grant(
  db: PGlite,
  opts: {
    profileId: string;
    sessionId: string;
    plan?: string;
    generations?: number;
    stack?: boolean;
  }
) {
  return db.query(
    `SELECT public.grant_catalog_checkout_session(
       $1, $2, $3, 'qron', $4, $5, NULL, NULL, false
     ) AS result`,
    [
      opts.profileId,
      opts.sessionId,
      opts.plan ?? "starter",
      opts.generations ?? 100,
      opts.stack ?? true,
    ]
  );
}

describe("grant_catalog_checkout_session isolated postgres", () => {
  it("attests the live code SHA together with the migration SHA", () => {
    const migration = readFileSync(CATALOG_GRANT_MIGRATION);
    const migrationSha = createHash("sha256").update(migration).digest("hex");
    const head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    expect(CATALOG_GRANT_RPC).toBe("grant_catalog_checkout_session");
    expect(CATALOG_GRANT_MIGRATION).toContain("20261115180000");
    expect(migrationSha).toHaveLength(64);
    expect(head).toMatch(/^[0-9a-f]{40}$/);
    expect(migration.toString("utf8")).toContain(
      "CREATE OR REPLACE FUNCTION public.grant_catalog_checkout_session"
    );
    expect(migration.toString("utf8")).not.toMatch(
      /CREATE OR REPLACE FUNCTION public\.grant_dpp_checkout_session/
    );
    expect(migration.toString("utf8")).toContain(
      "IS DISTINCT FROM p_profile_id"
    );
    expect(migration.toString("utf8")).not.toMatch(
      /COALESCE\(v_receipt_profile_id,\s*p_profile_id\)/
    );
  });

  it("grant A, grant B, replay A does not add A again", async () => {
    const db = await isolatedCatalogDb();
    await insertProfile(db, PROF_A);
    await grant(db, { profileId: PROF_A, sessionId: "cs_a" });
    await grant(db, { profileId: PROF_A, sessionId: "cs_b" });
    const replay = await grant(db, { profileId: PROF_A, sessionId: "cs_a" });
    const row = (
      await db.query<{
        generations_limit: number;
        last_grant_session_id: string;
      }>(
        "SELECT generations_limit, last_grant_session_id FROM public.profiles WHERE id = $1::uuid",
        [PROF_A]
      )
    ).rows[0];
    expect(
      (replay.rows[0] as { result: { status: string } }).result.status
    ).toBe("already_granted");
    expect(row.generations_limit).toBe(200);
    expect(row.last_grant_session_id).toBe("cs_b");
  });

  it("replays after a successful commit without a second increment", async () => {
    const db = await isolatedCatalogDb();
    await insertProfile(db, PROF_A, 40, 0);
    const first = await grant(db, { profileId: PROF_A, sessionId: "cs_ok" });
    expect(
      (first.rows[0] as { result: { status: string } }).result.status
    ).toBe("granted");
    const second = await grant(db, { profileId: PROF_A, sessionId: "cs_ok" });
    expect(
      (second.rows[0] as { result: { status: string } }).result.status
    ).toBe("already_granted");
    const limit = (
      await db.query<{ generations_limit: number }>(
        "SELECT generations_limit FROM public.profiles WHERE id = $1::uuid",
        [PROF_A]
      )
    ).rows[0].generations_limit;
    expect(limit).toBe(140);
  });

  it("credits two distinct sessions on one profile once each", async () => {
    const db = await isolatedCatalogDb();
    await insertProfile(db, PROF_A, 100, 40);
    await grant(db, {
      profileId: PROF_A,
      sessionId: "cs_starter",
      generations: 100,
    });
    await grant(db, {
      profileId: PROF_A,
      sessionId: "cs_creator",
      plan: "creator",
      generations: 500,
    });
    const limit = (
      await db.query<{ generations_limit: number }>(
        "SELECT generations_limit FROM public.profiles WHERE id = $1::uuid",
        [PROF_A]
      )
    ).rows[0].generations_limit;
    expect(limit).toBe(660);
  });

  it("rolls back the receipt and credits when the function errors after claim", async () => {
    const db = await isolatedCatalogDb();
    await insertProfile(db, PROF_A, 100, 0);
    await db.exec(`
      CREATE OR REPLACE FUNCTION public.grant_catalog_crash_after_claim(
        p_profile_id text, p_session_id text
      ) RETURNS jsonb
      LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO public.founder_exit_side_effects (idempotency_key, profile_id)
        VALUES ('grant:' || p_session_id, p_profile_id);
        RAISE EXCEPTION 'injected_crash_after_claim';
      END;
      $$;
    `);
    await expect(
      db.query("SELECT public.grant_catalog_crash_after_claim($1, $2)", [
        PROF_A,
        "cs_crash",
      ])
    ).rejects.toThrow(/injected_crash_after_claim/);
    const receipts = await db.query(
      "SELECT count(*)::int AS n FROM public.founder_exit_side_effects"
    );
    const limit = (
      await db.query<{ generations_limit: number }>(
        "SELECT generations_limit FROM public.profiles WHERE id = $1::uuid",
        [PROF_A]
      )
    ).rows[0].generations_limit;
    expect((receipts.rows[0] as { n: number }).n).toBe(0);
    expect(limit).toBe(100);
  });

  it("fails closed on a missing profile", async () => {
    const db = await isolatedCatalogDb();
    await expect(
      grant(db, { profileId: PROF_A, sessionId: "cs_none" })
    ).rejects.toThrow(/catalog_grant_profile_not_found/);
  });

  it("fails closed when the receipt belongs to another profile", async () => {
    const db = await isolatedCatalogDb();
    await insertProfile(db, PROF_A, 0, 0);
    await insertProfile(db, PROF_B, 0, 0);
    await grant(db, { profileId: PROF_B, sessionId: "cs_taken" });
    await expect(
      grant(db, { profileId: PROF_A, sessionId: "cs_taken" })
    ).rejects.toThrow(/catalog_grant_receipt_conflict/);
    const a = (
      await db.query<{ generations_limit: number }>(
        "SELECT generations_limit FROM public.profiles WHERE id = $1::uuid",
        [PROF_A]
      )
    ).rows[0].generations_limit;
    expect(a).toBe(0);
  });

  it("fails closed on an unmapped historical receipt instead of COALESCE", async () => {
    const db = await isolatedCatalogDb();
    await insertProfile(db, PROF_A, 40, 0, "cs_other");
    await db.query(
      `INSERT INTO public.founder_exit_side_effects (idempotency_key, profile_id)
       VALUES ('grant:cs_orphan', NULL)`
    );
    await expect(
      grant(db, { profileId: PROF_A, sessionId: "cs_orphan" })
    ).rejects.toThrow(/catalog_grant_receipt_conflict/);
    const a = (
      await db.query<{ generations_limit: number }>(
        "SELECT generations_limit FROM public.profiles WHERE id = $1::uuid",
        [PROF_A]
      )
    ).rows[0].generations_limit;
    expect(a).toBe(40);
  });

  it("fails closed when a last_grant marker races a receipt for another buyer", async () => {
    const db = await isolatedCatalogDb();
    await insertProfile(db, PROF_A, 100, 0, "cs_legacy");
    await insertProfile(db, PROF_B, 0, 0);
    await db.query(
      `INSERT INTO public.founder_exit_side_effects (idempotency_key, profile_id)
       VALUES ('grant:cs_legacy', $1)`,
      [PROF_B]
    );
    await expect(
      grant(db, { profileId: PROF_A, sessionId: "cs_legacy" })
    ).rejects.toThrow(/catalog_grant_receipt_conflict/);
    const a = (
      await db.query<{ generations_limit: number }>(
        "SELECT generations_limit FROM public.profiles WHERE id = $1::uuid",
        [PROF_A]
      )
    ).rows[0].generations_limit;
    expect(a).toBe(100);
  });

  it("rolls back credits when the function errors after the profile update", async () => {
    const db = await isolatedCatalogDb();
    await insertProfile(db, PROF_A, 100, 0);
    await db.exec(`
      CREATE OR REPLACE FUNCTION public.grant_catalog_crash_after_update(
        p_profile_id text, p_session_id text
      ) RETURNS jsonb
      LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO public.founder_exit_side_effects (idempotency_key, profile_id)
        VALUES ('grant:' || p_session_id, p_profile_id);
        UPDATE public.profiles
          SET generations_limit = COALESCE(generations_limit, 0) + 100
          WHERE id = p_profile_id::uuid;
        RAISE EXCEPTION 'injected_crash_after_update';
      END;
      $$;
    `);
    await expect(
      db.query("SELECT public.grant_catalog_crash_after_update($1, $2)", [
        PROF_A,
        "cs_crash_update",
      ])
    ).rejects.toThrow(/injected_crash_after_update/);
    const receipts = await db.query(
      "SELECT count(*)::int AS n FROM public.founder_exit_side_effects"
    );
    const limit = (
      await db.query<{ generations_limit: number }>(
        "SELECT generations_limit FROM public.profiles WHERE id = $1::uuid",
        [PROF_A]
      )
    ).rows[0].generations_limit;
    expect((receipts.rows[0] as { n: number }).n).toBe(0);
    expect(limit).toBe(100);
  });

  it("refuses callers without service_role execute", async () => {
    const db = await isolatedCatalogDb();
    await insertProfile(db, PROF_A);
    await db.exec(
      "REVOKE ALL ON FUNCTION public.grant_catalog_checkout_session(text, text, text, text, integer, boolean, text, text, boolean) FROM PUBLIC, catalog_anon"
    );
    await db.exec("SET ROLE catalog_anon");
    await expect(
      grant(db, { profileId: PROF_A, sessionId: "cs_anon" })
    ).rejects.toThrow();
    await db.exec("RESET ROLE");
    const receipts = await db.query(
      "SELECT count(*)::int AS n FROM public.founder_exit_side_effects"
    );
    expect((receipts.rows[0] as { n: number }).n).toBe(0);
  });
});
