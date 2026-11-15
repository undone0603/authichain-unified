/**
 * Two-connection PostgreSQL for grant_catalog_checkout_session.
 * Spawns a throwaway local cluster. Never uses a hosted database URL.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CATALOG_GRANT_MIGRATION, CATALOG_GRANT_RPC } from "./provisioning";

const PROF_A = "11111111-1111-1111-1111-111111111111";
const PROF_B = "22222222-2222-2222-2222-222222222222";
const SCHEMA = `
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
    DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;

function pgBinDir(): string | null {
  const fromConfig = process.env.PG_BINDIR?.trim();
  let fromPgConfig = "";
  try {
    fromPgConfig = spawnSync("pg_config", ["--bindir"], {
      encoding: "utf8",
    }).stdout.trim();
  } catch {
    fromPgConfig = "";
  }
  const candidates = [
    fromConfig,
    fromPgConfig,
    "/usr/lib/postgresql/16/bin",
    "/usr/lib/postgresql/15/bin",
    "/usr/lib/postgresql/14/bin",
    "/usr/pgsql-16/bin",
  ].filter((x): x is string => Boolean(x));
  for (const dir of candidates) {
    if (existsSync(join(dir, "initdb")) && existsSync(join(dir, "postgres"))) {
      return dir;
    }
  }
  return null;
}

const binDir = pgBinDir();
const required = process.env.CATALOG_GRANT_PG_REQUIRED === "1";

type Cluster = {
  port: number;
  dataDir: string;
  child: ChildProcess;
};

let cluster: Cluster | null = null;

function randomPort(): number {
  return 55000 + (randomBytes(2).readUInt16BE(0) % 1000);
}

async function waitForListen(port: number): Promise<void> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const client = new Client({
      host: "127.0.0.1",
      port,
      user: "catalog",
      database: "postgres",
      connectionTimeoutMillis: 500,
    });
    try {
      await client.connect();
      await client.end();
      return;
    } catch {
      await sleep(100);
    }
  }
  throw new Error(`local catalog grant cluster did not listen on ${port}`);
}

async function startCluster(): Promise<Cluster> {
  if (!binDir) {
    throw new Error("PostgreSQL initdb/postgres binaries not found");
  }
  const dataDir = mkdtempSync(join(tmpdir(), "catalog-grant-pg-"));
  const port = randomPort();
  const init = spawnSync(
    join(binDir, "initdb"),
    [
      "-D",
      dataDir,
      "-A",
      "trust",
      "--username=catalog",
      "--no-sync",
      "--auth=trust",
    ],
    { encoding: "utf8" }
  );
  if (init.status !== 0) {
    throw new Error(init.stderr || "initdb failed");
  }
  const child = spawn(
    join(binDir, "postgres"),
    [
      "-D",
      dataDir,
      "-p",
      String(port),
      "-k",
      dataDir,
      "-c",
      "listen_addresses=127.0.0.1",
      "-c",
      "fsync=off",
      "-c",
      "full_page_writes=off",
    ],
    { stdio: "ignore" }
  );
  try {
    await waitForListen(port);
  } catch (error) {
    child.kill("SIGTERM");
    throw error;
  }
  return { port, dataDir, child };
}

function stopCluster(started: Cluster) {
  started.child.kill("SIGTERM");
  try {
    rmSync(started.dataDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

async function connect(): Promise<Client> {
  if (!cluster) throw new Error("cluster not started");
  const client = new Client({
    host: "127.0.0.1",
    port: cluster.port,
    user: "catalog",
    database: "postgres",
  });
  await client.connect();
  return client;
}

async function applySchema(client: Client) {
  await client.query(SCHEMA);
  await client.query(readFileSync(CATALOG_GRANT_MIGRATION, "utf8"));
}

async function insertProfile(client: Client, id: string, limit = 0, used = 0) {
  await client.query(
    `INSERT INTO public.profiles
       (id, generations_limit, generations_used, last_grant_session_id)
     VALUES ($1::uuid, $2, $3, NULL)`,
    [id, limit, used]
  );
}

async function grantOnce(
  client: Client,
  opts: {
    profileId: string;
    sessionId: string;
    plan?: string;
    generations?: number;
    stack?: boolean;
  }
) {
  const result = await client.query<{ result: { status: string } }>(
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
  return result.rows[0].result;
}

async function grantRetry(
  client: Client,
  opts: Parameters<typeof grantOnce>[1]
) {
  let last: unknown;
  for (let i = 0; i < 8; i += 1) {
    try {
      return await grantOnce(client, opts);
    } catch (error) {
      last = error;
      const code = (error as { code?: string }).code;
      if (code === "40001" || code === "40P01") continue;
      throw error;
    }
  }
  throw last;
}

const describePg = binDir || required ? describe : describe.skip;

describePg("grant_catalog_checkout_session two-connection PostgreSQL", () => {
  beforeAll(async () => {
    if (!binDir) {
      throw new Error(
        "CATALOG_GRANT_PG_REQUIRED=1 but PostgreSQL binaries were not found"
      );
    }
    cluster = await startCluster();
    const setup = await connect();
    try {
      await applySchema(setup);
    } finally {
      await setup.end();
    }
  }, 30000);

  afterAll(() => {
    if (cluster) stopCluster(cluster);
  });

  it("attests the live RPC name and migration SHA on the two-connection cluster", () => {
    const migration = readFileSync(CATALOG_GRANT_MIGRATION);
    expect(CATALOG_GRANT_RPC).toBe("grant_catalog_checkout_session");
    expect(createHash("sha256").update(migration).digest("hex")).toHaveLength(
      64
    );
  });

  it("grants a session only once when two connections deliver it together", async () => {
    const a = await connect();
    const b = await connect();
    try {
      await insertProfile(a, PROF_A, 0, 0);
      const [left, right] = await Promise.all([
        grantRetry(a, { profileId: PROF_A, sessionId: "cs_race" }),
        grantRetry(b, { profileId: PROF_A, sessionId: "cs_race" }),
      ]);
      const statuses = [left.status, right.status].sort();
      expect(statuses).toEqual(["already_granted", "granted"]);
      const row = await a.query<{
        generations_limit: number;
        n: number;
      }>(
        `SELECT p.generations_limit,
                (SELECT count(*)::int FROM public.founder_exit_side_effects
                  WHERE idempotency_key = 'grant:cs_race') AS n
           FROM public.profiles p WHERE id = $1::uuid`,
        [PROF_A]
      );
      expect(row.rows[0].generations_limit).toBe(100);
      expect(row.rows[0].n).toBe(1);
    } finally {
      await a.query("DELETE FROM public.founder_exit_side_effects");
      await a.query("DELETE FROM public.profiles");
      await a.end();
      await b.end();
    }
  });

  it("stacks two distinct sessions delivered on two connections", async () => {
    const a = await connect();
    const b = await connect();
    try {
      await insertProfile(a, PROF_B, 0, 0);
      const [left, right] = await Promise.all([
        grantRetry(a, {
          profileId: PROF_B,
          sessionId: "cs_one",
          generations: 100,
        }),
        grantRetry(b, {
          profileId: PROF_B,
          sessionId: "cs_two",
          generations: 100,
        }),
      ]);
      expect([left.status, right.status].sort()).toEqual([
        "granted",
        "granted",
      ]);
      const row = await a.query<{ generations_limit: number; n: number }>(
        `SELECT p.generations_limit,
                (SELECT count(*)::int FROM public.founder_exit_side_effects) AS n
           FROM public.profiles p WHERE id = $1::uuid`,
        [PROF_B]
      );
      expect(row.rows[0].generations_limit).toBe(200);
      expect(row.rows[0].n).toBe(2);
    } finally {
      await a.query("DELETE FROM public.founder_exit_side_effects");
      await a.query("DELETE FROM public.profiles");
      await a.end();
      await b.end();
    }
  });

  it("rolls back the real RPC when a receipt-insert trigger aborts", async () => {
    const client = await connect();
    try {
      await insertProfile(client, PROF_A, 100, 0);
      await client.query(`
        CREATE OR REPLACE FUNCTION public.catalog_grant_boom_after_receipt()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.idempotency_key = 'grant:cs_crash_claim' THEN
            RAISE EXCEPTION 'injected_crash_after_claim';
          END IF;
          RETURN NEW;
        END;
        $$;
        DROP TRIGGER IF EXISTS catalog_grant_boom_after_receipt
          ON public.founder_exit_side_effects;
        CREATE TRIGGER catalog_grant_boom_after_receipt
          AFTER INSERT ON public.founder_exit_side_effects
          FOR EACH ROW EXECUTE FUNCTION public.catalog_grant_boom_after_receipt();
      `);
      await expect(
        grantOnce(client, { profileId: PROF_A, sessionId: "cs_crash_claim" })
      ).rejects.toThrow(/injected_crash_after_claim/);
      const row = await client.query<{
        generations_limit: number;
        n: number;
      }>(
        `SELECT p.generations_limit,
                (SELECT count(*)::int FROM public.founder_exit_side_effects) AS n
           FROM public.profiles p WHERE id = $1::uuid`,
        [PROF_A]
      );
      expect(row.rows[0].generations_limit).toBe(100);
      expect(row.rows[0].n).toBe(0);
    } finally {
      await client.query(
        "DROP TRIGGER IF EXISTS catalog_grant_boom_after_receipt ON public.founder_exit_side_effects"
      );
      await client.query("DELETE FROM public.founder_exit_side_effects");
      await client.query("DELETE FROM public.profiles");
      await client.end();
    }
  });

  it("rolls back the real RPC when a profile-update trigger aborts", async () => {
    const client = await connect();
    try {
      await insertProfile(client, PROF_A, 100, 0);
      await client.query(`
        CREATE OR REPLACE FUNCTION public.catalog_grant_boom_after_update()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.last_grant_session_id = 'cs_crash_update' THEN
            RAISE EXCEPTION 'injected_crash_after_update';
          END IF;
          RETURN NEW;
        END;
        $$;
        DROP TRIGGER IF EXISTS catalog_grant_boom_after_update ON public.profiles;
        CREATE TRIGGER catalog_grant_boom_after_update
          AFTER UPDATE ON public.profiles
          FOR EACH ROW EXECUTE FUNCTION public.catalog_grant_boom_after_update();
      `);
      await expect(
        grantOnce(client, { profileId: PROF_A, sessionId: "cs_crash_update" })
      ).rejects.toThrow(/injected_crash_after_update/);
      const row = await client.query<{
        generations_limit: number;
        n: number;
      }>(
        `SELECT p.generations_limit,
                (SELECT count(*)::int FROM public.founder_exit_side_effects) AS n
           FROM public.profiles p WHERE id = $1::uuid`,
        [PROF_A]
      );
      expect(row.rows[0].generations_limit).toBe(100);
      expect(row.rows[0].n).toBe(0);
    } finally {
      await client.query(
        "DROP TRIGGER IF EXISTS catalog_grant_boom_after_update ON public.profiles"
      );
      await client.query("DELETE FROM public.founder_exit_side_effects");
      await client.query("DELETE FROM public.profiles");
      await client.end();
    }
  });
});
