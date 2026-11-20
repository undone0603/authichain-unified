/** Isolated PostgreSQL-engine coverage for #2482; never queries production. */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MIGRATION = "supabase/migrations/20261119133000_dpp_activation_delivery_outbox.sql";
const PROFILE = "11111111-1111-1111-1111-111111111111";
let db: PGlite;
async function rpc(name: string, sql: string, params: unknown[]) {
  const result = await db.query<{ result: { status: string; claim_token?: string } }>(
    "SELECT public." + name + "(" + sql + ") AS result", params
  );
  return result.rows[0].result;
}
const prepare = (s: string) => rpc("dpp_activation_prepare", "$1", [s]);
const enqueue = (s: string, profile = PROFILE, demo = false) =>
  rpc("dpp_activation_enqueue", "$1,$2,$3", [s, profile, demo]);
const claim = (s: string) =>
  rpc("dpp_activation_claim", "$1,$2", [s, PROFILE]);
const begin = (s: string, token: string) =>
  rpc("dpp_activation_begin_send", "$1,$2::uuid", [s, token]);
const finish = (s: string, token: string, accepted: boolean) =>
  rpc("dpp_activation_finish_send", "$1,$2::uuid,$3,$4,$5,$6", [
    s, token, accepted, "resend", accepted ? 200 : null,
    accepted ? "email_receipt_2482" : null
  ]);
const receipt = (s: string) => db.query(
  "INSERT INTO public.founder_exit_side_effects(idempotency_key,profile_id) VALUES($1,$2)",
  ["grant:" + s, PROFILE]
);
async function state(s: string) {
  const result = await db.query<{
    state: string; send_attempts: number; profile_id: string;
  }>("SELECT state,send_attempts,profile_id FROM public.dpp_activation_outbox WHERE session_id=$1",[s]);
  return result.rows[0];
}

describe("DPP durable activation outbox (isolated PostgreSQL)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(
      "DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;" +
      "DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;" +
      "DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;" +
      "CREATE TABLE public.founder_exit_side_effects (" +
      "idempotency_key text PRIMARY KEY, profile_id text NOT NULL);"
    );
    // Simulate projects retaining older default Data API table grants.
    await db.exec(
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;"
    );
    await db.exec(readFileSync(MIGRATION,"utf8"));
  });
  afterAll(async () => { if(db) await db.close(); });

  it("fails closed unless the atomic grant receipt matches the profile", async () => {
    await prepare("cs_test_no_receipt_2482");
    await expect(enqueue("cs_test_no_receipt_2482")).rejects.toThrow(
      /dpp_activation_grant_receipt_mismatch/
    );
    await receipt("cs_test_receipt_2482");
    await prepare("cs_test_receipt_2482");
    await expect(enqueue("cs_test_receipt_2482","other-profile")).rejects.toThrow(
      /dpp_activation_grant_receipt_mismatch/
    );
    expect((await enqueue("cs_test_receipt_2482")).status).toBe("pending");
  });

  it("holds legacy successful grants without a preparatory marker", async () => {
    const s="cs_test_legacy_2482";
    await receipt(s);
    expect((await enqueue(s)).status).toBe("legacy_untracked");
    const result = await db.query<{n:number}>(
      "SELECT count(*)::int AS n FROM public.dpp_activation_outbox WHERE session_id=$1",[s]
    );
    expect(result.rows[0].n).toBe(0);
  });

  it("deduplicates simultaneous claims to a single lease before provider contact", async () => {
    const s="cs_test_concurrent_2482";
    await receipt(s);
    await prepare(s);
    await enqueue(s);
    const [a,b]=await Promise.all([claim(s),claim(s)]);
    expect([a.status,b.status].sort()).toEqual(["busy","claimed"]);
    const owner=a.status==="claimed"?a:b;
    expect(owner.claim_token).toBeTruthy();
    expect((await begin(s,owner.claim_token!)).status).toBe("armed");
    await expect(begin(s,owner.claim_token!)).rejects.toThrow(/send_lease_lost/);
    expect((await state(s)).send_attempts).toBe(1);
    expect((await finish(s,owner.claim_token!,true)).status).toBe("accepted");
    expect((await claim(s)).status).toBe("accepted");
    expect((await state(s)).send_attempts).toBe(1);
  });

  it("recovers an expired unarmed lease and rejects the previous owner", async () => {
    const s="cs_test_unarmed_2482";
    await receipt(s);
    await prepare(s);
    await enqueue(s);
    const first=await claim(s);
    expect(first.status).toBe("claimed");
    await db.query(
      "UPDATE public.dpp_activation_outbox SET lease_until=now()-interval '1 second' WHERE session_id=$1",[s]
    );
    const second=await claim(s);
    expect(second.status).toBe("claimed");
    expect(second.claim_token).not.toBe(first.claim_token);
    await expect(begin(s,first.claim_token!)).rejects.toThrow(/send_lease_lost/);
    expect((await begin(s,second.claim_token!)).status).toBe("armed");
  });

  it("holds after crash or timeout once sending began, without a second attempt", async () => {
    const s="cs_test_ambiguous_2482";
    await receipt(s);
    await prepare(s);
    await enqueue(s);
    const token=(await claim(s)).claim_token!;
    await begin(s,token);
    await db.query(
      "UPDATE public.dpp_activation_outbox SET lease_until=now()-interval '1 second' WHERE session_id=$1",[s]
    );
    expect((await claim(s)).status).toBe("held");
    expect((await state(s))).toMatchObject({state:"needs_reconciliation",send_attempts:1});
    expect((await claim(s)).status).toBe("held");
  });

  it("holds provider non-acceptance for manual reconciliation", async () => {
    const s="cs_test_rejected_2482";
    await receipt(s);
    await prepare(s);
    await enqueue(s);
    const token=(await claim(s)).claim_token!;
    await begin(s,token);
    expect((await finish(s,token,false)).status).toBe("needs_reconciliation");
    expect((await claim(s)).status).toBe("held");
    expect((await state(s)).send_attempts).toBe(1);
  });

  it("never enqueues a smoke demo and grants no execute privileges to public roles", async () => {
    expect((await enqueue("cs_test_demo_2482",PROFILE,true)).status).toBe("skipped_demo");
    const r=await db.query<{
      anon_execute: boolean; authenticated_execute:boolean;
      service_execute:boolean; rls_enabled:boolean;
      direct_select:boolean; direct_insert:boolean; direct_update:boolean; direct_delete:boolean;
    }>("SELECT " +
      "has_function_privilege('anon','public.dpp_activation_claim(text,text)','EXECUTE') AS anon_execute, " +
      "has_function_privilege('authenticated','public.dpp_activation_claim(text,text)','EXECUTE') AS authenticated_execute, " +
      "has_function_privilege('service_role','public.dpp_activation_claim(text,text)','EXECUTE') AS service_execute, " +
      "has_table_privilege('service_role','public.dpp_activation_outbox','SELECT') AS direct_select, " +
      "has_table_privilege('service_role','public.dpp_activation_outbox','INSERT') AS direct_insert, " +
      "has_table_privilege('service_role','public.dpp_activation_outbox','UPDATE') AS direct_update, " +
      "has_table_privilege('service_role','public.dpp_activation_outbox','DELETE') AS direct_delete, " +
      "relrowsecurity AS rls_enabled FROM pg_class WHERE oid='public.dpp_activation_outbox'::regclass"
    );
    expect(r.rows[0]).toMatchObject({
      anon_execute:false, authenticated_execute:false, service_execute:true, rls_enabled:true,
      direct_select:false, direct_insert:false, direct_update:false, direct_delete:false
    });
    const cols=await db.query<{column_name:string}>(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='dpp_activation_outbox'"
    );
    expect(cols.rows.map(x=>x.column_name)).not.toEqual(
      expect.arrayContaining(["email","recipient","subject","body","html"])
    );
  });
});
