/**
 * Postgres store for the founder-exit continuity ledger.
 *
 * This is not an economic ledger. Cash stays with classifyRevenue.
 * Payment idempotency stays on public.stripe_events.
 * Entitlements stay on public.profiles.
 *
 * Node only. Do not import this file from a Cloudflare worker.
 * The sync state machine remains in ledger.ts. This wrapper flushes
 * after each public call. A side-effect insert commits in its own
 * transaction, before success is written.
 */

import { Pool, type PoolClient } from "pg";
import {
  attemptAction,
  beginExecution,
  completeVerified,
  continuitySnapshot,
  ContinuityLog,
  markSubmitted,
  recover,
  resumeWithAgent,
  type ActionRecord,
  type AgentIdentity,
  type ContinuitySnapshot,
  type CreateActionInput,
  type EvidenceClass,
  type RecoveryCounts,
} from "./ledger";

const REPLICA_ACTION_ID = "act_replica_interrupt";
const REPLICA_IDEMPOTENCY_KEY = "replica-effect-1";
const REPLICA_T0 = new Date("2026-10-13T21:00:00.000Z");
const REPLICA_LEASE_MS = 60_000;

const JSON_COLUMNS = new Set([
  "delegation_chain",
  "input_evidence_refs",
  "output_evidence_refs",
  "economic_event_refs",
  "history",
]);

const COLUMNS = [
  "action_id",
  "idempotency_key",
  "action_type",
  "agent_id",
  "agent_identity_version",
  "parent_action_id",
  "delegation_chain",
  "created_at",
  "started_at",
  "updated_at",
  "completed_at",
  "state",
  "authorization_decision",
  "policy_version",
  "input_evidence_refs",
  "output_evidence_refs",
  "economic_event_refs",
  "retry_count",
  "next_retry_at",
  "lease_owner",
  "lease_expires_at",
  "error_class",
  "error_detail_redacted",
  "recovery_instruction",
  "measurement_definition",
  "measurement_result",
  "verification_status",
  "supersedes_action_id",
  "correlation_id",
  "trace_id",
  "request_submitted",
  "request_accepted",
  "external_completed",
  "result_independently_verified",
  "result_reconciled",
  "history",
] as const;

type ActionColumn = (typeof COLUMNS)[number];

const MUTABLE_COLUMNS = COLUMNS.filter(
  column => column !== "action_id" && column !== "idempotency_key"
);

const SELECT_ACTIONS = `select ${COLUMNS.join(", ")} from public.founder_exit_actions order by action_id`;

export function assertReplicaUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("replica_url_not_local");
  }
  const host = parsed.hostname;
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
    throw new Error("replica_url_not_local");
  }
  if (parsed.pathname.toLowerCase().includes("nhdnkzhtadfkkluiulhs")) {
    throw new Error("replica_url_not_local");
  }
}

function asJson<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

function asIso(value: unknown, required: boolean): string | null {
  if (value == null) {
    if (required) throw new Error("missing_timestamp");
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error("bad_timestamp");
  return date.toISOString();
}

function rowToAction(row: Record<string, unknown>): ActionRecord {
  return {
    action_id: String(row.action_id),
    idempotency_key: String(row.idempotency_key),
    action_type: String(row.action_type),
    agent_id: String(row.agent_id),
    agent_identity_version: String(row.agent_identity_version),
    parent_action_id:
      row.parent_action_id == null ? null : String(row.parent_action_id),
    delegation_chain: asJson<string[]>(row.delegation_chain),
    created_at: asIso(row.created_at, true) as string,
    started_at: asIso(row.started_at, false),
    updated_at: asIso(row.updated_at, true) as string,
    completed_at: asIso(row.completed_at, false),
    state: row.state as ActionRecord["state"],
    authorization_decision:
      row.authorization_decision as ActionRecord["authorization_decision"],
    policy_version: String(row.policy_version),
    input_evidence_refs: asJson<string[]>(row.input_evidence_refs),
    output_evidence_refs: asJson<string[]>(row.output_evidence_refs),
    economic_event_refs: asJson<string[]>(row.economic_event_refs),
    retry_count: Number(row.retry_count),
    next_retry_at: asIso(row.next_retry_at, false),
    lease_owner: row.lease_owner == null ? null : String(row.lease_owner),
    lease_expires_at: asIso(row.lease_expires_at, false),
    error_class: row.error_class == null ? null : String(row.error_class),
    error_detail_redacted:
      row.error_detail_redacted == null
        ? null
        : String(row.error_detail_redacted),
    recovery_instruction:
      row.recovery_instruction == null
        ? null
        : String(row.recovery_instruction),
    measurement_definition: String(row.measurement_definition),
    measurement_result:
      row.measurement_result == null ? null : String(row.measurement_result),
    verification_status: row.verification_status as EvidenceClass,
    supersedes_action_id:
      row.supersedes_action_id == null
        ? null
        : String(row.supersedes_action_id),
    correlation_id: String(row.correlation_id),
    trace_id: row.trace_id == null ? null : String(row.trace_id),
    request_submitted: Boolean(row.request_submitted),
    request_accepted: Boolean(row.request_accepted),
    external_completed: Boolean(row.external_completed),
    result_independently_verified: Boolean(row.result_independently_verified),
    result_reconciled: Boolean(row.result_reconciled),
    history: asJson<ActionRecord["history"]>(row.history),
  };
}

function bindValue(column: ActionColumn, row: ActionRecord): unknown {
  const value = row[column];
  if (JSON_COLUMNS.has(column)) return JSON.stringify(value ?? []);
  return value;
}

function placeholders(): string {
  return COLUMNS.map((column, index) => {
    const slot = `$${index + 1}`;
    return JSON_COLUMNS.has(column) ? `${slot}::jsonb` : slot;
  }).join(", ");
}

const UPSERT_SQL = `
insert into public.founder_exit_actions (${COLUMNS.join(", ")})
values (${placeholders()})
on conflict (action_id) do update set
${MUTABLE_COLUMNS.map(column => `${column} = excluded.${column}`).join(",\n")}
`;

async function upsertAction(
  client: PoolClient,
  row: ActionRecord
): Promise<void> {
  await client.query(
    UPSERT_SQL,
    COLUMNS.map(column => bindValue(column, row))
  );
}

export class PostgresContinuityLog {
  readonly inner: ContinuityLog;
  private readonly pending = new Map<string, ActionRecord>();
  private pendingOrder: string[] = [];
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly pool: Pool) {
    this.inner = new ContinuityLog(row => {
      if (!this.pending.has(row.action_id))
        this.pendingOrder.push(row.action_id);
      this.pending.set(row.action_id, row);
    });
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.tail.then(work, work);
    this.tail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  async reload(): Promise<void> {
    await this.enqueue(() => this.reloadNow());
  }

  private async reloadNow(): Promise<void> {
    const actions =
      await this.pool.query<Record<string, unknown>>(SELECT_ACTIONS);
    const effects = await this.pool.query<{ idempotency_key: string }>(
      "select idempotency_key from public.founder_exit_side_effects order by idempotency_key"
    );
    this.inner.ledger.loadRows(actions.rows.map(row => rowToAction(row)));
    this.inner.effects.loadKeys(effects.rows.map(row => row.idempotency_key));
    this.pending.clear();
    this.pendingOrder = [];
  }

  private async reloadEffects(): Promise<void> {
    const effects = await this.pool.query<{ idempotency_key: string }>(
      "select idempotency_key from public.founder_exit_side_effects order by idempotency_key"
    );
    this.inner.effects.loadKeys(effects.rows.map(row => row.idempotency_key));
  }

  async flush(): Promise<void> {
    await this.enqueue(() => this.flushNow());
  }

  private async flushNow(): Promise<void> {
    if (this.pendingOrder.length === 0) return;
    const ids = [...this.pendingOrder];
    const rows = ids.map(id => {
      const row = this.pending.get(id);
      if (!row) throw new Error("missing_pending_action");
      return row;
    });
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      for (const row of rows) await upsertAction(client, row);
      await client.query("commit");
      ids.forEach((id, index) => {
        if (this.pending.get(id) === rows[index]) this.pending.delete(id);
      });
      this.pendingOrder = this.pendingOrder.filter(id => this.pending.has(id));
    } catch (err) {
      try {
        await client.query("rollback");
      } catch {
        // The connection may already be dead. reload uses a new connection.
      }
      try {
        await this.reloadNow();
      } catch {
        // Keep the original write error.
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async recordSideEffect(key: string): Promise<"recorded" | "duplicate"> {
    return this.enqueue(() => this.recordSideEffectNow(key));
  }

  private async recordSideEffectNow(
    key: string
  ): Promise<"recorded" | "duplicate"> {
    const result = this.inner.recordSideEffect(key);
    if (result === "duplicate") return "duplicate";
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const inserted = await client.query(
        `insert into public.founder_exit_side_effects (idempotency_key)
         values ($1)
         on conflict do nothing
         returning idempotency_key`,
        [key]
      );
      await client.query("commit");
      if ((inserted.rowCount ?? 0) === 0) {
        this.inner.effects.applications -= 1;
        this.inner.effects.duplicates += 1;
        return "duplicate";
      }
      return "recorded";
    } catch (err) {
      try {
        await client.query("rollback");
      } catch {
        // Connection already closed.
      }
      try {
        await this.reloadEffects();
      } catch {
        // Keep the original insert error.
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async attempt(
    input: CreateActionInput,
    now: Date
  ): Promise<{ action: ActionRecord; created: boolean }> {
    return this.enqueue(async () => {
      const created = attemptAction(this.inner, input, now);
      await this.flushNow();
      return created;
    });
  }

  async begin(
    actionId: string,
    agent: AgentIdentity,
    now: Date,
    ttlMs: number
  ): Promise<ActionRecord> {
    return this.enqueue(async () => {
      const row = beginExecution(this.inner, actionId, agent, now, ttlMs);
      await this.flushNow();
      return row;
    });
  }

  async markSubmitted(
    actionId: string,
    agentId: string,
    now: Date
  ): Promise<ActionRecord> {
    return this.enqueue(async () => {
      const row = markSubmitted(this.inner, actionId, agentId, now);
      await this.flushNow();
      return row;
    });
  }

  async complete(
    actionId: string,
    agent: AgentIdentity,
    result: {
      measurement_result: string;
      verification_status: EvidenceClass;
      output_evidence_refs: string[];
      simulated?: boolean;
    },
    now: Date
  ): Promise<ActionRecord> {
    return this.enqueue(async () => {
      const row = completeVerified(this.inner, actionId, agent, result, now);
      await this.flushNow();
      return row;
    });
  }

  async resume(
    actionId: string,
    agent: AgentIdentity,
    now: Date,
    ttlMs: number
  ): Promise<ActionRecord> {
    return this.enqueue(async () => {
      const row = resumeWithAgent(this.inner, actionId, agent, now, ttlMs);
      await this.flushNow();
      return row;
    });
  }

  async recover(
    now: Date,
    opts: { actor: string; maxRetries?: number; rng?: () => number } = {
      actor: "recovery",
    }
  ): Promise<RecoveryCounts> {
    return this.enqueue(async () => {
      const counts = recover(this.inner, now, opts);
      await this.flushNow();
      return counts;
    });
  }

  snapshot(): ContinuitySnapshot {
    return continuitySnapshot(this.inner);
  }
}

const REPLICA_AGENT: AgentIdentity = {
  agent_id: "agent-replica",
  identity_version: "1",
  capabilities: ["retry_idempotent"],
  revoked: false,
};

export async function startInterruptedReplica(pool: Pool): Promise<{
  action_id: string;
  idempotency_key: string;
  state: ActionRecord["state"];
}> {
  const log = new PostgresContinuityLog(pool);
  await log.reload();
  const created = await log.attempt(
    {
      action_id: REPLICA_ACTION_ID,
      idempotency_key: REPLICA_IDEMPOTENCY_KEY,
      action_type: "retry_idempotent",
      agent: REPLICA_AGENT,
      correlation_id: "corr-replica-drill",
      trace_id: "trace-replica-drill",
      measurement_definition:
        "one committed side effect, then recovery of the same action id",
      input_evidence_refs: ["drill:local-postgres-replica"],
    },
    REPLICA_T0
  );
  if (!created.created) throw new Error("replica_action_already_present");
  await log.begin(
    REPLICA_ACTION_ID,
    REPLICA_AGENT,
    REPLICA_T0,
    REPLICA_LEASE_MS
  );
  const recorded = await log.recordSideEffect(REPLICA_IDEMPOTENCY_KEY);
  if (recorded !== "recorded") throw new Error("side_effect_not_recorded");
  const row = log.inner.ledger.get(REPLICA_ACTION_ID);
  if (row?.state !== "running") throw new Error("expected_running");
  return {
    action_id: REPLICA_ACTION_ID,
    idempotency_key: REPLICA_IDEMPOTENCY_KEY,
    state: row.state,
  };
}

export type ReplicaRecovery = {
  action_id: string;
  idempotency_key: string;
  final_state: ActionRecord["state"];
  verification_status: EvidenceClass;
  reconciled: number;
  side_effect_applications: number;
  duplicate_side_effect: "recorded" | "duplicate";
  history_length: number;
};

export async function finishInterruptedReplica(
  pool: Pool
): Promise<ReplicaRecovery> {
  const log = new PostgresContinuityLog(pool);
  await log.reload();
  const before = log.inner.ledger.get(REPLICA_ACTION_ID);
  if (!before) throw new Error("missing_restored_action");
  if (before.state !== "running") {
    throw new Error(`expected_running:${before.state}`);
  }
  if (!log.inner.effects.has(REPLICA_IDEMPOTENCY_KEY)) {
    throw new Error("missing_restored_side_effect");
  }
  const counts = await log.recover(
    new Date(REPLICA_T0.getTime() + REPLICA_LEASE_MS + 1),
    { actor: "recovery", rng: () => 0 }
  );
  const check = new PostgresContinuityLog(pool);
  await check.reload();
  const row = check.inner.ledger.get(REPLICA_ACTION_ID);
  if (!row) throw new Error("missing_recovered_action");
  const duplicate = await check.recordSideEffect(REPLICA_IDEMPOTENCY_KEY);
  const dbCount = await pool.query<{ n: number }>(
    "select count(*)::int as n from public.founder_exit_side_effects where idempotency_key = $1",
    [REPLICA_IDEMPOTENCY_KEY]
  );
  return {
    action_id: REPLICA_ACTION_ID,
    idempotency_key: REPLICA_IDEMPOTENCY_KEY,
    final_state: row.state,
    verification_status: row.verification_status,
    reconciled: counts.reconciled,
    side_effect_applications: dbCount.rows[0]?.n ?? 0,
    duplicate_side_effect: duplicate,
    history_length: row.history.length,
  };
}

export async function assertDeleteForbidden(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    let rejected = false;
    try {
      await client.query(
        "delete from public.founder_exit_actions where action_id = $1",
        [REPLICA_ACTION_ID]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("delete_forbidden")) rejected = true;
      else throw err;
    }
    if (!rejected) throw new Error("delete_was_accepted");
  } finally {
    try {
      await client.query("rollback");
    } catch {
      // The rejected delete already aborted the transaction.
    }
    client.release();
  }
}

export async function assertHistoryImmutable(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    let rejected = false;
    try {
      await client.query(
        `update public.founder_exit_actions
         set history = '[]'::jsonb
         where action_id = $1`,
        [REPLICA_ACTION_ID]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("history_shortened") ||
        message.includes("history_rewritten")
      ) {
        rejected = true;
      } else {
        throw err;
      }
    }
    if (!rejected) throw new Error("history_rewrite_was_accepted");
  } finally {
    try {
      await client.query("rollback");
    } catch {
      // The failed update already aborted the transaction.
    }
    client.release();
  }
}
