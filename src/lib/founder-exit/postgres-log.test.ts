import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  assertReplicaUrl,
  finishInterruptedReplica,
  startInterruptedReplica,
} from "./postgres-log";

const databaseUrl = process.env.FOUNDER_EXIT_DATABASE_URL;

describe("founder exit replica url", () => {
  it("refuses a non-local database", () => {
    expect(() =>
      assertReplicaUrl("postgres://db.example.com/founder_exit")
    ).toThrow("replica_url_not_local");
    expect(() =>
      assertReplicaUrl("postgres://127.0.0.1/nhdnkzhtadfkkluiulhs")
    ).toThrow("replica_url_not_local");
    expect(() =>
      assertReplicaUrl("postgres://postgres@127.0.0.1:55432/founder_exit")
    ).not.toThrow();
  });
});

describe("founder exit replica evidence", () => {
  it("records a passed local dump, restore, and recovery", () => {
    const evidence = JSON.parse(
      readFileSync("docs/evidence/founder-exit-replica-drill.json", "utf8")
    );
    expect(evidence.environment).toBe("local_postgres_16_schema_replica");
    expect(evidence.production_data_copied).toBe(false);
    expect(evidence.dump_restore).toBe("pass");
    expect(evidence.interruption).toBe("pass");
    expect(evidence.final_state).toBe("succeeded");
    expect(evidence.verification_status).toBe("verified");
    expect(evidence.side_effect_applications).toBe(1);
    expect(evidence.duplicate_side_effect).toBe("duplicate");
    expect(evidence.history_rewrite_rejected).toBe(true);
    expect(evidence.delete_rejected).toBe(true);
    expect(evidence.stripe_called).toBe(false);
    expect(evidence.mail_sent).toBe(false);
    expect(evidence.founder_independent).toBe(false);
    expect(typeof evidence.production_migration_applied).toBe("boolean");
  });
});

describe.skipIf(!databaseUrl)("founder exit postgres interruption", () => {
  it("recovers one side effect after the process is dropped", async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await pool.query(
        "truncate public.founder_exit_actions, public.founder_exit_side_effects"
      );
      const started = await startInterruptedReplica(pool);
      expect(started.state).toBe("running");
      const finished = await finishInterruptedReplica(pool);
      expect(finished.final_state).toBe("succeeded");
      expect(finished.verification_status).toBe("verified");
      expect(finished.reconciled).toBe(1);
      expect(finished.side_effect_applications).toBe(1);
      expect(finished.duplicate_side_effect).toBe("duplicate");
      expect(finished.history_length).toBeGreaterThanOrEqual(4);
    } finally {
      await pool.end();
    }
  });
});
