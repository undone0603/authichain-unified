/**
 * Continuity writes for the live webhook, through the Supabase service
 * client that worker already has. This is not a second economic ledger.
 * Cash stays with classifyRevenue. Payment idempotency stays on stripe_events.
 * Entitlements stay on profiles.
 *
 * Do not import postgres-log.ts from here. That module uses node-pg, and the
 * apex webhook has no DATABASE_URL.
 */

import {
  attemptAction,
  beginExecution,
  completeVerified,
  ContinuityLog,
  type ActionRecord,
  type AgentIdentity,
} from "./ledger";

type DbError = { code?: string; message?: string } | null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContinuitySupabase = { from: (table: string) => any };

const WEBHOOK_AGENT: AgentIdentity = {
  agent_id: "stripe-webhook",
  identity_version: "2026-10-13",
  capabilities: ["reconcile"],
  revoked: false,
};

const LEASE_MS = 5 * 60_000;

function fail(scope: string, error: DbError): void {
  if (!error) return;
  console.error(`[founder-exit] ${scope} ${error.code ?? "error"}`);
  throw new Error(`continuity_${scope}_failed`);
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
    delegation_chain: asJson<string[]>(row.delegation_chain ?? []),
    created_at: asIso(row.created_at, true) as string,
    started_at: asIso(row.started_at, false),
    updated_at: asIso(row.updated_at, true) as string,
    completed_at: asIso(row.completed_at, false),
    state: row.state as ActionRecord["state"],
    authorization_decision:
      row.authorization_decision as ActionRecord["authorization_decision"],
    policy_version: String(row.policy_version),
    input_evidence_refs: asJson<string[]>(row.input_evidence_refs ?? []),
    output_evidence_refs: asJson<string[]>(row.output_evidence_refs ?? []),
    economic_event_refs: asJson<string[]>(row.economic_event_refs ?? []),
    retry_count: Number(row.retry_count ?? 0),
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
    verification_status:
      row.verification_status as ActionRecord["verification_status"],
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
    history: asJson<ActionRecord["history"]>(row.history ?? []),
  };
}

function payloadOf(row: ActionRecord): Record<string, unknown> {
  return { ...row };
}

async function loadByKey(
  supabase: ContinuitySupabase,
  idempotencyKey: string
): Promise<ActionRecord | null> {
  const { data, error } = await supabase
    .from("founder_exit_actions")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  fail("load", error);
  if (!data) return null;
  return rowToAction(data as Record<string, unknown>);
}

async function persistAction(
  supabase: ContinuitySupabase,
  row: ActionRecord,
  existed: boolean
): Promise<void> {
  const payload = payloadOf(row);
  if (!existed) {
    const { error } = await supabase
      .from("founder_exit_actions")
      .insert(payload);
    fail("insert", error);
    return;
  }
  const { action_id: _actionId, idempotency_key: _key, ...mutable } = payload;
  const { error } = await supabase
    .from("founder_exit_actions")
    .update(mutable)
    .eq("action_id", row.action_id);
  fail("update", error);
}

async function insertSideEffect(
  supabase: ContinuitySupabase,
  key: string
): Promise<"recorded" | "duplicate"> {
  const { error } = await supabase
    .from("founder_exit_side_effects")
    .insert({ idempotency_key: key });
  if (error?.code === "23505") return "duplicate";
  fail("side_effect", error);
  return "recorded";
}

export type ProvisionContinuityInput = {
  sessionId: string;
  amountCents: number | null;
  isDemo: boolean;
  plan: string;
  now?: Date;
};

function ids(input: ProvisionContinuityInput): {
  actionId: string;
  idempotencyKey: string;
  sideEffectKey: string;
} {
  return {
    actionId: `dpp-fulfill:${input.sessionId}`,
    idempotencyKey: `dpp_fulfill:${input.sessionId}`,
    sideEffectKey: `grant:${input.sessionId}`,
  };
}

/**
 * Write the running action before provisionPurchase. A failure here throws
 * so the grant does not run without a continuity row. Stripe retries.
 */
export async function beginProvisionContinuity(
  supabase: ContinuitySupabase,
  input: ProvisionContinuityInput
): Promise<void> {
  const now = input.now ?? new Date();
  const { actionId, idempotencyKey } = ids(input);
  const existing = await loadByKey(supabase, idempotencyKey);
  if (existing?.state === "running" || existing?.state === "succeeded") {
    return;
  }
  // A denied, blocked, or otherwise non-resumable row must not fall through
  // into provisionPurchase. This writer only inserts running or succeeded.
  if (existing && existing.state !== "authorized") {
    throw new Error("continuity_state_not_resumable");
  }
  const log = new ContinuityLog();
  if (existing) log.ledger.loadRows([existing]);
  if (!existing) {
    attemptAction(
      log,
      {
        action_id: actionId,
        idempotency_key: idempotencyKey,
        action_type: "reconcile",
        agent: WEBHOOK_AGENT,
        correlation_id: idempotencyKey,
        trace_id: actionId,
        measurement_definition:
          "one DPP grant for this checkout session, then one continuity row",
        input_evidence_refs: ["stripe:checkout.session.completed"],
        economic_event_refs: [
          `amount_cents:${input.amountCents ?? "null"}`,
          `plan:${input.plan}`,
          input.isDemo ? "is_demo:true" : "is_demo:false",
        ],
      },
      now
    );
  }
  const current = log.ledger.get(actionId);
  if (current?.state === "authorized") {
    beginExecution(log, actionId, WEBHOOK_AGENT, now, LEASE_MS);
  }
  const row = log.ledger.get(actionId);
  if (!row) throw new Error("continuity_action_missing");
  await persistAction(supabase, row, existing != null);
}

/**
 * Record the grant key, then mark the same action succeeded. Call only after
 * provisionPurchase has returned a non-failed status. The key insert commits
 * on its own request, before the success update.
 */
export async function finishProvisionContinuity(
  supabase: ContinuitySupabase,
  input: ProvisionContinuityInput & { grantAlreadyPresent: boolean }
): Promise<"recorded" | "duplicate"> {
  const now = input.now ?? new Date();
  const { actionId, idempotencyKey, sideEffectKey } = ids(input);
  const existing = await loadByKey(supabase, idempotencyKey);
  if (!existing) throw new Error("continuity_action_missing");
  const recorded = await insertSideEffect(supabase, sideEffectKey);
  if (existing.state === "succeeded") return recorded;
  const log = new ContinuityLog();
  log.ledger.loadRows([existing]);
  completeVerified(
    log,
    actionId,
    WEBHOOK_AGENT,
    {
      measurement_result: input.grantAlreadyPresent
        ? "grant_already_present"
        : "grant_persisted",
      verification_status: "observed_unverified",
      output_evidence_refs: [`side-effect:${sideEffectKey}`],
    },
    now
  );
  const row = log.ledger.get(actionId);
  if (!row) throw new Error("continuity_action_missing");
  await persistAction(supabase, row, true);
  return recorded;
}
