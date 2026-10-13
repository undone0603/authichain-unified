/**
 * Operational continuity ledger for founder absence.
 *
 * This is not an economic ledger and not a second price catalogue.
 * Cash stays with classifyRevenue. Payment idempotency stays with
 * public.stripe_events. Entitlements stay on public.profiles.
 * This module records whether an authorized action survived interruption.
 *
 * The memory and file stores are the CI implementation. The Postgres store
 * lives in postgres-log.ts and is not imported by the payment webhook.
 * This module does not call Stripe or send mail.
 */

import {
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const POLICY_VERSION = "founder-exit-2026-10-13";

export const ACTION_STATES = [
  "queued",
  "authorized",
  "running",
  "awaiting_external_result",
  "succeeded",
  "retryable_failure",
  "permanent_failure",
  "blocked",
  "cancelled",
  "denied",
  "reconciliation_required",
] as const;

export type ActionState = (typeof ACTION_STATES)[number];

export type EvidenceClass =
  | "verified"
  | "observed_unverified"
  | "estimated"
  | "simulated"
  | "blocked"
  | "unknown";

export type AuthorizationDecision =
  "permitted" | "denied" | "awaiting_approval";

export type AuditEvent = {
  at: string;
  from: ActionState | null;
  to: ActionState;
  actor: string;
  reason: string;
};

export type ActionRecord = {
  action_id: string;
  idempotency_key: string;
  action_type: string;
  agent_id: string;
  agent_identity_version: string;
  parent_action_id: string | null;
  delegation_chain: string[];
  created_at: string;
  started_at: string | null;
  updated_at: string;
  completed_at: string | null;
  state: ActionState;
  authorization_decision: AuthorizationDecision;
  policy_version: string;
  input_evidence_refs: string[];
  output_evidence_refs: string[];
  economic_event_refs: string[];
  retry_count: number;
  next_retry_at: string | null;
  lease_owner: string | null;
  lease_expires_at: string | null;
  error_class: string | null;
  error_detail_redacted: string | null;
  recovery_instruction: string | null;
  measurement_definition: string;
  measurement_result: string | null;
  verification_status: EvidenceClass;
  supersedes_action_id: string | null;
  correlation_id: string;
  trace_id: string | null;
  request_submitted: boolean;
  request_accepted: boolean;
  external_completed: boolean;
  result_independently_verified: boolean;
  result_reconciled: boolean;
  history: AuditEvent[];
};

export type AgentIdentity = {
  agent_id: string;
  identity_version: string;
  capabilities: readonly string[];
  revoked: boolean;
};

export type EconomicEvidenceInput = {
  amount_cents: number | null;
  is_demo: boolean;
  is_founder: boolean;
  provider_verified: boolean;
  entitlement_persisted: boolean;
  activated: boolean;
};

export type EconomicEvidence = {
  payment: EvidenceClass;
  entitlement: EvidenceClass;
  activation: EvidenceClass;
  recognized_revenue: EvidenceClass;
  notes: string[];
};

const AUTONOMOUS = new Set([
  "inspect",
  "reconcile",
  "draft",
  "retry_idempotent",
  "collect_evidence",
  "measure",
]);

const APPROVAL_REQUIRED = new Set([
  "deploy",
  "migrate",
  "send_outbound",
  "charge",
  "refund",
  "transfer",
  "bind_commitment",
  "rotate_credential",
  "destroy",
]);

const TERMINAL = new Set<ActionState>([
  "succeeded",
  "permanent_failure",
  "cancelled",
  "denied",
]);

const TRANSITIONS: Record<ActionState, readonly ActionState[]> = {
  queued: ["authorized", "denied", "blocked", "cancelled"],
  authorized: ["running", "blocked", "cancelled", "denied"],
  running: [
    "awaiting_external_result",
    "succeeded",
    "retryable_failure",
    "permanent_failure",
    "reconciliation_required",
    "blocked",
  ],
  awaiting_external_result: [
    "succeeded",
    "retryable_failure",
    "permanent_failure",
    "reconciliation_required",
  ],
  retryable_failure: [
    "authorized",
    "permanent_failure",
    "blocked",
    "reconciliation_required",
  ],
  reconciliation_required: ["succeeded", "permanent_failure", "blocked"],
  blocked: ["authorized", "cancelled", "denied"],
  succeeded: [],
  permanent_failure: [],
  cancelled: [],
  denied: [],
};

export type ActionPatch = Partial<
  Omit<ActionRecord, "history" | "action_id" | "idempotency_key" | "state">
>;

export type CreateActionInput = {
  action_id: string;
  idempotency_key: string;
  action_type: string;
  agent: AgentIdentity;
  parent_action_id?: string | null;
  delegation_chain?: string[];
  correlation_id: string;
  trace_id?: string | null;
  measurement_definition: string;
  input_evidence_refs?: string[];
  economic_event_refs?: string[];
  retry_count?: number;
  supersedes_action_id?: string | null;
  secret_required?: boolean;
  secret_present?: boolean;
  standing_approval?: boolean;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function redactDetail(detail: string): string {
  return detail
    .replace(/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/\bwhsec_[A-Za-z0-9]+/g, "[redacted]");
}

export function retryDelayMs(
  retryCount: number,
  rng: () => number = Math.random,
  baseMs = 1000,
  capMs = 60_000
): number {
  const exp = Math.min(capMs, baseMs * 2 ** Math.max(0, retryCount - 1));
  const jitter = Math.floor(exp * 0.2 * rng());
  return exp + jitter;
}

export function decideAuthorization(
  agent: AgentIdentity,
  actionType: string,
  standingApproval: boolean
): { decision: AuthorizationDecision; state: ActionState; reason: string } {
  if (agent.revoked) {
    return {
      decision: "denied",
      state: "denied",
      reason: "agent revoked",
    };
  }
  if (APPROVAL_REQUIRED.has(actionType)) {
    if (!standingApproval || !agent.capabilities.includes(actionType)) {
      return {
        decision: "awaiting_approval",
        state: "blocked",
        reason: standingApproval
          ? "missing capability for approval-required action"
          : "standing approval required",
      };
    }
    return {
      decision: "permitted",
      state: "authorized",
      reason: "standing approval and capability",
    };
  }
  if (!AUTONOMOUS.has(actionType)) {
    return {
      decision: "denied",
      state: "denied",
      reason: "action type is not in the bounded policy",
    };
  }
  const allowed =
    agent.capabilities.includes(actionType) ||
    agent.capabilities.includes("operate_internal");
  if (!allowed) {
    return {
      decision: "denied",
      state: "denied",
      reason: "missing capability",
    };
  }
  return {
    decision: "permitted",
    state: "authorized",
    reason: "bounded autonomous policy",
  };
}

/**
 * Separate payment, entitlement, activation, and recognized revenue.
 * This module never recognizes revenue. classifyRevenue remains the cash rule.
 * A persisted entitlement without provider verification is not accepted.
 */
export function classifyEconomicEvidence(
  input: EconomicEvidenceInput
): EconomicEvidence {
  const notes: string[] = [
    "recognized revenue is not decided here; classifyRevenue is the cash classifier",
  ];
  let payment: EvidenceClass = "unknown";
  if (input.is_demo || input.amount_cents === 0) {
    payment = "simulated";
    notes.push("demo or zero amount is not a customer payment");
  } else if (input.is_founder) {
    payment = input.provider_verified ? "observed_unverified" : "unknown";
    notes.push("founder charge is not qualifying revenue");
  } else if (!input.provider_verified) {
    payment = "unknown";
    notes.push(
      "payment is unknown until a signature-verified provider event exists"
    );
  } else if (input.amount_cents === 29900) {
    payment = "verified";
    notes.push(
      "provider-verified non-founder 29900 is a payment milestone only"
    );
  } else if (input.amount_cents != null && input.amount_cents > 0) {
    payment = "observed_unverified";
  }

  const entitlement: EvidenceClass =
    input.entitlement_persisted && payment === "verified"
      ? "observed_unverified"
      : "blocked";
  if (input.entitlement_persisted && payment !== "verified") {
    notes.push(
      "entitlement flag ignored without a verified non-founder payment"
    );
  }

  const activation: EvidenceClass =
    input.activated && entitlement === "observed_unverified"
      ? "observed_unverified"
      : "blocked";

  return {
    payment,
    entitlement,
    activation,
    recognized_revenue: "blocked",
    notes,
  };
}

export class MemorySideEffects {
  private keys = new Set<string>();
  applications = 0;
  duplicates = 0;

  record(key: string): "recorded" | "duplicate" {
    if (this.keys.has(key)) {
      this.duplicates += 1;
      return "duplicate";
    }
    this.keys.add(key);
    this.applications += 1;
    return "recorded";
  }

  has(key: string): boolean {
    return this.keys.has(key);
  }

  keysSnapshot(): string[] {
    return [...this.keys].sort();
  }

  loadKeys(keys: readonly string[]): void {
    this.keys = new Set(keys);
    this.applications = this.keys.size;
    this.duplicates = 0;
  }
}

export class MemoryActionLedger {
  private rows = new Map<string, ActionRecord>();
  private byKey = new Map<string, string>();
  failNextMutation = false;
  private onCommit?: (row: ActionRecord) => void;

  constructor(onCommit?: (row: ActionRecord) => void) {
    this.onCommit = onCommit;
  }

  get(actionId: string): ActionRecord | null {
    const row = this.rows.get(actionId);
    return row ? clone(row) : null;
  }

  findByIdempotency(key: string): ActionRecord | null {
    const id = this.byKey.get(key);
    return id ? this.get(id) : null;
  }

  list(): ActionRecord[] {
    return [...this.rows.values()].map(row => clone(row));
  }

  listOpen(): ActionRecord[] {
    return this.list().filter(row => !TERMINAL.has(row.state));
  }

  loadRows(actions: readonly ActionRecord[]): void {
    this.rows.clear();
    this.byKey.clear();
    for (const action of actions) {
      this.rows.set(action.action_id, clone(action));
      this.byKey.set(action.idempotency_key, action.action_id);
    }
  }

  create(
    input: CreateActionInput,
    now: Date
  ): { action: ActionRecord; created: boolean } {
    const existing = this.findByIdempotency(input.idempotency_key);
    if (existing) return { action: existing, created: false };
    const at = now.toISOString();
    const row: ActionRecord = {
      action_id: input.action_id,
      idempotency_key: input.idempotency_key,
      action_type: input.action_type,
      agent_id: input.agent.agent_id,
      agent_identity_version: input.agent.identity_version,
      parent_action_id: input.parent_action_id ?? null,
      delegation_chain: input.delegation_chain ?? [input.agent.agent_id],
      created_at: at,
      started_at: null,
      updated_at: at,
      completed_at: null,
      state: "queued",
      authorization_decision: "awaiting_approval",
      policy_version: POLICY_VERSION,
      input_evidence_refs: input.input_evidence_refs ?? [],
      output_evidence_refs: [],
      economic_event_refs: input.economic_event_refs ?? [],
      retry_count: input.retry_count ?? 0,
      next_retry_at: null,
      lease_owner: null,
      lease_expires_at: null,
      error_class: null,
      error_detail_redacted: null,
      recovery_instruction: null,
      measurement_definition: input.measurement_definition,
      measurement_result: null,
      verification_status: "unknown",
      supersedes_action_id: input.supersedes_action_id ?? null,
      correlation_id: input.correlation_id,
      trace_id: input.trace_id ?? null,
      request_submitted: false,
      request_accepted: false,
      external_completed: false,
      result_independently_verified: false,
      result_reconciled: false,
      history: [
        {
          at,
          from: null,
          to: "queued",
          actor: input.agent.agent_id,
          reason: "accepted into the ledger",
        },
      ],
    };
    return { action: this.commit(row), created: true };
  }

  transition(
    actionId: string,
    to: ActionState,
    patch: ActionPatch,
    actor: string,
    reason: string,
    now: Date
  ): ActionRecord {
    const current = this.rows.get(actionId);
    if (!current) throw new Error("missing_action");
    if (!TRANSITIONS[current.state].includes(to)) {
      throw new Error(`illegal_transition ${current.state} -> ${to}`);
    }
    const safePatch = { ...patch };
    if (typeof safePatch.error_detail_redacted === "string") {
      safePatch.error_detail_redacted = redactDetail(
        safePatch.error_detail_redacted
      );
    }
    const at = now.toISOString();
    const next: ActionRecord = {
      ...current,
      ...safePatch,
      action_id: current.action_id,
      idempotency_key: current.idempotency_key,
      state: to,
      updated_at: at,
      completed_at: TERMINAL.has(to) ? at : current.completed_at,
      history: [
        ...current.history,
        { at, from: current.state, to, actor, reason },
      ],
    };
    return this.commit(next);
  }

  private commit(row: ActionRecord): ActionRecord {
    if (this.failNextMutation) {
      this.failNextMutation = false;
      throw new Error("database_timeout");
    }
    const stored = clone(row);
    const previous = this.rows.get(stored.action_id) ?? null;
    this.rows.set(stored.action_id, stored);
    this.byKey.set(stored.idempotency_key, stored.action_id);
    try {
      this.onCommit?.(stored);
    } catch (err) {
      if (previous) this.rows.set(stored.action_id, previous);
      else this.rows.delete(stored.action_id);
      if (!previous) this.byKey.delete(stored.idempotency_key);
      throw err;
    }
    return clone(stored);
  }
}

export class ContinuityLog {
  readonly ledger: MemoryActionLedger;
  readonly effects = new MemorySideEffects();

  constructor(onCommit?: (row: ActionRecord) => void) {
    this.ledger = new MemoryActionLedger(onCommit);
  }

  recordSideEffect(key: string): "recorded" | "duplicate" {
    return this.effects.record(key);
  }
}

type SnapshotFile = { actions: ActionRecord[]; side_effects: string[] };

export type ContinuityStore = {
  ledger: MemoryActionLedger;
  effects: MemorySideEffects;
  recordSideEffect(key: string): "recorded" | "duplicate";
};

export class FileContinuityLog implements ContinuityStore {
  readonly effects = new MemorySideEffects();
  readonly ledger: MemoryActionLedger;
  readonly filePath: string;
  private loading = true;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.ledger = new MemoryActionLedger(() => {
      if (!this.loading) this.flush();
    });
    if (existsSync(this.filePath)) {
      const parsed = JSON.parse(
        readFileSync(this.filePath, "utf8")
      ) as SnapshotFile;
      this.ledger.loadRows(parsed.actions ?? []);
      this.effects.loadKeys(parsed.side_effects ?? []);
    }
    this.loading = false;
  }

  recordSideEffect(key: string): "recorded" | "duplicate" {
    const result = this.effects.record(key);
    this.flush();
    return result;
  }

  private flush(): void {
    const snapshot: SnapshotFile = {
      actions: this.ledger.list(),
      side_effects: this.effects.keysSnapshot(),
    };
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(snapshot));
    renameSync(tmp, this.filePath);
  }
}

export function attemptAction(
  log: ContinuityStore,
  input: CreateActionInput,
  now: Date
): { action: ActionRecord; created: boolean } {
  const existing = log.ledger.findByIdempotency(input.idempotency_key);
  if (existing) return { action: existing, created: false };
  const created = log.ledger.create(input, now);
  if (input.secret_required && !input.secret_present) {
    const action = log.ledger.transition(
      created.action.action_id,
      "blocked",
      {
        authorization_decision: "awaiting_approval",
        error_class: "secret_unavailable",
        recovery_instruction:
          "The required secret is absent. Resume this action id after it is restored. Do not invent a secret.",
        verification_status: "blocked",
      },
      input.agent.agent_id,
      "secret unavailable",
      now
    );
    return { action, created: true };
  }
  const decision = decideAuthorization(
    input.agent,
    input.action_type,
    input.standing_approval === true
  );
  const action = log.ledger.transition(
    created.action.action_id,
    decision.state,
    {
      authorization_decision: decision.decision,
      verification_status:
        decision.state === "authorized" ? "unknown" : "blocked",
      recovery_instruction:
        decision.state === "blocked"
          ? "Waiting for standing approval. Founder absence is not approval."
          : decision.state === "denied"
            ? "Denied. A new agent must hold the capability and must not be revoked."
            : null,
    },
    input.agent.agent_id,
    decision.reason,
    now
  );
  return { action, created: true };
}

export function beginExecution(
  log: ContinuityStore,
  actionId: string,
  agent: AgentIdentity,
  now: Date,
  ttlMs: number
): ActionRecord {
  const current = log.ledger.get(actionId);
  if (!current) throw new Error("missing_action");
  if (agent.revoked) throw new Error("revoked");
  if (current.authorization_decision !== "permitted")
    throw new Error("not_permitted");
  if (
    current.lease_owner &&
    current.lease_expires_at &&
    current.lease_expires_at > now.toISOString() &&
    current.lease_owner !== agent.agent_id
  ) {
    throw new Error("lease_held");
  }
  return log.ledger.transition(
    actionId,
    "running",
    {
      started_at: current.started_at ?? now.toISOString(),
      lease_owner: agent.agent_id,
      lease_expires_at: new Date(now.getTime() + ttlMs).toISOString(),
    },
    agent.agent_id,
    "lease acquired",
    now
  );
}

export function markSubmitted(
  log: ContinuityStore,
  actionId: string,
  agentId: string,
  now: Date
): ActionRecord {
  return log.ledger.transition(
    actionId,
    "awaiting_external_result",
    { request_submitted: true },
    agentId,
    "request submitted; outcome unknown",
    now
  );
}

export function completeVerified(
  log: ContinuityStore,
  actionId: string,
  agent: AgentIdentity,
  result: {
    measurement_result: string;
    verification_status: EvidenceClass;
    output_evidence_refs: string[];
    simulated?: boolean;
  },
  now: Date
): ActionRecord {
  const current = log.ledger.get(actionId);
  if (!current) throw new Error("missing_action");
  if (agent.revoked) throw new Error("revoked");
  if (current.lease_owner && current.lease_owner !== agent.agent_id) {
    throw new Error("lease_held");
  }
  if (result.simulated && result.verification_status === "verified") {
    throw new Error("simulated_cannot_verify");
  }
  if (
    result.verification_status === "verified" &&
    result.output_evidence_refs.length === 0
  ) {
    throw new Error("missing_evidence");
  }
  return log.ledger.transition(
    actionId,
    "succeeded",
    {
      measurement_result: result.measurement_result,
      verification_status: result.verification_status,
      output_evidence_refs: result.output_evidence_refs,
      result_independently_verified: result.verification_status === "verified",
      result_reconciled: true,
      external_completed:
        current.request_submitted || current.external_completed,
      lease_owner: null,
      lease_expires_at: null,
    },
    agent.agent_id,
    "explicit completion",
    now
  );
}

export function resumeWithAgent(
  log: ContinuityStore,
  actionId: string,
  agent: AgentIdentity,
  now: Date,
  ttlMs: number
): ActionRecord {
  const current = log.ledger.get(actionId);
  if (!current) throw new Error("missing_action");
  if (current.state !== "authorized") throw new Error("not_resumable");
  if (current.authorization_decision !== "permitted")
    throw new Error("not_permitted");
  if (agent.revoked) throw new Error("revoked");
  const capable =
    agent.capabilities.includes(current.action_type) ||
    agent.capabilities.includes("operate_internal");
  if (!capable) throw new Error("missing_capability");
  return log.ledger.transition(
    actionId,
    "running",
    {
      agent_id: agent.agent_id,
      agent_identity_version: agent.identity_version,
      started_at: current.started_at ?? now.toISOString(),
      lease_owner: agent.agent_id,
      lease_expires_at: new Date(now.getTime() + ttlMs).toISOString(),
      delegation_chain: [...current.delegation_chain, agent.agent_id],
    },
    agent.agent_id,
    "replacement resumed already-authorized work",
    now
  );
}

function leaseActive(action: ActionRecord, now: Date): boolean {
  return Boolean(
    action.lease_owner &&
    action.lease_expires_at &&
    action.lease_expires_at > now.toISOString()
  );
}

function reconcileExisting(
  log: ContinuityStore,
  action: ActionRecord,
  actor: string,
  now: Date
): void {
  log.ledger.transition(
    action.action_id,
    "succeeded",
    {
      external_completed: true,
      result_independently_verified: true,
      result_reconciled: true,
      verification_status: "verified",
      measurement_result: "side_effect_present_once",
      output_evidence_refs: [`side-effect:${action.idempotency_key}`],
      lease_owner: null,
      lease_expires_at: null,
      recovery_instruction: null,
    },
    actor,
    "reconciled existing side effect; did not execute again",
    now
  );
}

function quarantineUnknown(
  log: ContinuityStore,
  action: ActionRecord,
  actor: string,
  now: Date
): void {
  log.ledger.transition(
    action.action_id,
    "reconciliation_required",
    {
      verification_status: "unknown",
      lease_owner: null,
      lease_expires_at: null,
      error_class: "external_outcome_unknown",
      recovery_instruction:
        "External outcome is unknown. Do not resubmit. Confirm the provider result, then reconcile this action id.",
    },
    actor,
    "timeout is not success or failure",
    now
  );
}

export type RecoveryCounts = {
  reconciled: number;
  requeued: number;
  quarantined: number;
  exhausted: number;
  touched: string[];
};

export function recover(
  log: ContinuityStore,
  now: Date,
  opts: { actor: string; maxRetries?: number; rng?: () => number } = {
    actor: "recovery",
  }
): RecoveryCounts {
  const maxRetries = opts.maxRetries ?? 5;
  const rng = opts.rng ?? (() => 0);
  const counts: RecoveryCounts = {
    reconciled: 0,
    requeued: 0,
    quarantined: 0,
    exhausted: 0,
    touched: [],
  };
  for (const action of log.ledger.list()) {
    if (
      action.state === "running" ||
      action.state === "awaiting_external_result"
    ) {
      if (action.state === "running" && leaseActive(action, now)) continue;
      counts.touched.push(action.action_id);
      if (log.effects.has(action.idempotency_key)) {
        reconcileExisting(log, action, opts.actor, now);
        counts.reconciled += 1;
        continue;
      }
      if (
        action.request_submitted ||
        action.state === "awaiting_external_result"
      ) {
        quarantineUnknown(log, action, opts.actor, now);
        counts.quarantined += 1;
        continue;
      }
      const nextRetry = action.retry_count + 1;
      if (nextRetry > maxRetries) {
        log.ledger.transition(
          action.action_id,
          "permanent_failure",
          {
            retry_count: nextRetry,
            error_class: "retry_exhausted",
            verification_status: "unknown",
            lease_owner: null,
            lease_expires_at: null,
            recovery_instruction:
              "Retries are exhausted. Do not execute again.",
          },
          opts.actor,
          "retry budget exhausted",
          now
        );
        counts.exhausted += 1;
        continue;
      }
      log.ledger.transition(
        action.action_id,
        "retryable_failure",
        {
          retry_count: nextRetry,
          next_retry_at: new Date(
            now.getTime() + retryDelayMs(nextRetry, rng)
          ).toISOString(),
          lease_owner: null,
          lease_expires_at: null,
          error_class: "interrupted",
          verification_status: "unknown",
          recovery_instruction:
            "Resume after next_retry_at only when the side effect is still absent.",
        },
        opts.actor,
        "interrupted before a side effect",
        now
      );
      counts.requeued += 1;
      continue;
    }
    if (action.state === "retryable_failure") {
      if (action.next_retry_at && action.next_retry_at > now.toISOString())
        continue;
      counts.touched.push(action.action_id);
      log.ledger.transition(
        action.action_id,
        "authorized",
        {
          authorization_decision: "permitted",
          recovery_instruction:
            "Due for resume. Execute only if the side effect is absent.",
        },
        opts.actor,
        "retry is due",
        now
      );
      counts.requeued += 1;
    }
  }
  return counts;
}

export type ContinuitySnapshot = {
  policy_version: string;
  unfinished: string[];
  ambiguous: string[];
  safe_to_resume: string[];
  blocked: string[];
  denied: string[];
  succeeded: string[];
};

export function continuitySnapshot(log: ContinuityStore): ContinuitySnapshot {
  const rows = log.ledger.list();
  const ids = (state: ActionState) =>
    rows.filter(row => row.state === state).map(row => row.action_id);
  return {
    policy_version: POLICY_VERSION,
    unfinished: rows
      .filter(row => !TERMINAL.has(row.state))
      .map(row => row.action_id)
      .sort(),
    ambiguous: ids("reconciliation_required").sort(),
    safe_to_resume: ids("authorized").sort(),
    blocked: ids("blocked").sort(),
    denied: ids("denied").sort(),
    succeeded: ids("succeeded").sort(),
  };
}

export type FounderExitReport = {
  drill_id: "founder-exit-2026-10-13";
  environment: "isolated_memory_and_temp_file";
  production_side_effects: false;
  stripe_called: false;
  mail_sent: false;
  migration_applied: false;
  policy_version: typeof POLICY_VERSION;
  generated_at: string;
  action_ids: {
    interrupted: string;
    continued: string;
    denied_after_revocation: string;
    resumed_by_replacement: string;
    blocked_send: string;
    blocked_charge: string;
  };
  idempotency_key: string;
  side_effect_applications: number;
  duplicate_side_effects: number;
  recovery_outcome: "reconciled_existing_side_effect";
  final_state: ActionState;
  verification_status: EvidenceClass;
  file_restart_applications: number;
  revoked_agent_denied: boolean;
  replacement_resumed: boolean;
  unapproved_production_operations: number;
  open_blockers: string[];
  economic: {
    demo_zero: EconomicEvidence;
    founder_1000: EconomicEvidence;
    unverified_entitlement: EconomicEvidence;
  };
  faults: Record<string, "pass" | "fail">;
  criteria: Record<string, "pass" | "fail">;
};

const T0 = new Date("2026-10-13T20:00:00.000Z");
const LEASE_MS = 60_000;

function at(ms: number): Date {
  return new Date(T0.getTime() + ms);
}

function baseInput(
  actionId: string,
  key: string,
  actionType: string,
  agent: AgentIdentity,
  extra: Partial<CreateActionInput> = {}
): CreateActionInput {
  return {
    action_id: actionId,
    idempotency_key: key,
    action_type: actionType,
    agent,
    correlation_id: "corr-founder-exit-drill",
    trace_id: "trace-founder-exit-drill",
    measurement_definition:
      "one side effect for this idempotency key, then a reconciled ledger row",
    input_evidence_refs: ["drill:isolated"],
    ...extra,
  };
}

function runFaults(): Record<string, "pass" | "fail"> {
  const faults: Record<string, "pass" | "fail"> = {};
  const mark = (name: string, ok: boolean) => {
    faults[name] = ok ? "pass" : "fail";
  };
  const agent: AgentIdentity = {
    agent_id: "agent-fault",
    identity_version: "1",
    capabilities: [
      "inspect",
      "retry_idempotent",
      "destroy",
      "operate_internal",
    ],
    revoked: false,
  };
  try {
    const log = new ContinuityLog();
    const created = attemptAction(
      log,
      baseInput("act_timeout", "timeout-1", "inspect", agent),
      T0
    );
    log.ledger.failNextMutation = true;
    let threw = false;
    try {
      beginExecution(log, created.action.action_id, agent, T0, LEASE_MS);
    } catch (err) {
      threw = err instanceof Error && err.message === "database_timeout";
    }
    mark(
      "database_timeout",
      threw && log.ledger.get(created.action.action_id)?.state === "authorized"
    );
  } catch {
    mark("database_timeout", false);
  }

  try {
    const log = new ContinuityLog();
    const first = attemptAction(
      log,
      baseInput("act_dup", "dup-1", "inspect", agent),
      T0
    );
    const second = attemptAction(
      log,
      baseInput("act_dup_other", "dup-1", "inspect", agent),
      T0
    );
    mark(
      "duplicate_delivery",
      first.created &&
        !second.created &&
        second.action.action_id === "act_dup" &&
        log.ledger.list().length === 1
    );
  } catch {
    mark("duplicate_delivery", false);
  }

  try {
    const log = new ContinuityLog();
    mark("worker_termination", true);
    const started = attemptAction(
      log,
      baseInput("act_worker", "worker-1", "retry_idempotent", agent),
      T0
    );
    beginExecution(log, started.action.action_id, agent, T0, LEASE_MS);
    log.recordSideEffect("worker-1");
    const recovered = recover(log, at(LEASE_MS + 1), {
      actor: "recovery",
      rng: () => 0,
    });
    mark(
      "worker_termination",
      recovered.reconciled === 1 &&
        log.ledger.get("act_worker")?.state === "succeeded" &&
        log.effects.applications === 1
    );
    mark(
      "expired_lease",
      log.ledger
        .get("act_worker")
        ?.history.some(event =>
          event.reason.includes("did not execute again")
        ) === true
    );
  } catch {
    mark("worker_termination", false);
    mark("expired_lease", false);
  }

  try {
    const log = new ContinuityLog();
    const started = attemptAction(
      log,
      baseInput("act_unknown", "unknown-1", "retry_idempotent", agent),
      T0
    );
    beginExecution(log, started.action.action_id, agent, T0, LEASE_MS);
    markSubmitted(log, "act_unknown", agent.agent_id, at(1000));
    recover(log, at(LEASE_MS + 5000), { actor: "recovery", rng: () => 0 });
    const row = log.ledger.get("act_unknown");
    mark(
      "provider_timeout_unknown",
      row?.state === "reconciliation_required" &&
        row.verification_status === "unknown" &&
        row.request_submitted &&
        !row.external_completed
    );
  } catch {
    mark("provider_timeout_unknown", false);
  }

  try {
    const effects = new MemorySideEffects();
    effects.record("hook-1");
    const again = effects.record("hook-1");
    mark(
      "duplicate_webhook",
      again === "duplicate" && effects.applications === 1
    );
  } catch {
    mark("duplicate_webhook", false);
  }

  try {
    const log = new ContinuityLog();
    const revoked: AgentIdentity = { ...agent, revoked: true };
    const row = attemptAction(
      log,
      baseInput("act_revoked", "revoked-1", "inspect", revoked),
      T0
    );
    mark(
      "revoked_agent",
      row.action.state === "denied" &&
        row.action.authorization_decision === "denied"
    );
  } catch {
    mark("revoked_agent", false);
  }

  try {
    const log = new ContinuityLog();
    const bare: AgentIdentity = { ...agent, capabilities: [] };
    const row = attemptAction(
      log,
      baseInput("act_bare", "bare-1", "inspect", bare),
      T0
    );
    mark("missing_capability", row.action.state === "denied");
  } catch {
    mark("missing_capability", false);
  }

  try {
    const log = new ContinuityLog();
    const row = attemptAction(
      log,
      baseInput("act_destroy", "destroy-1", "destroy", agent),
      T0
    );
    mark(
      "policy_denial",
      row.action.state === "blocked" &&
        row.action.authorization_decision === "awaiting_approval"
    );
  } catch {
    mark("policy_denial", false);
  }

  try {
    const log = new ContinuityLog();
    const started = attemptAction(
      log,
      baseInput("act_evidence", "evidence-1", "inspect", agent),
      T0
    );
    beginExecution(log, started.action.action_id, agent, T0, LEASE_MS);
    let threw = false;
    try {
      completeVerified(
        log,
        "act_evidence",
        agent,
        {
          measurement_result: "done",
          verification_status: "verified",
          output_evidence_refs: [],
        },
        at(1000)
      );
    } catch (err) {
      threw = err instanceof Error && err.message === "missing_evidence";
    }
    mark(
      "missing_evidence",
      threw && log.ledger.get("act_evidence")?.state === "running"
    );
  } catch {
    mark("missing_evidence", false);
  }

  try {
    const demo = classifyEconomicEvidence({
      amount_cents: 0,
      is_demo: true,
      is_founder: false,
      provider_verified: true,
      entitlement_persisted: true,
      activated: false,
    });
    const founder = classifyEconomicEvidence({
      amount_cents: 1000,
      is_demo: false,
      is_founder: true,
      provider_verified: true,
      entitlement_persisted: false,
      activated: false,
    });
    const unverified = classifyEconomicEvidence({
      amount_cents: 29900,
      is_demo: false,
      is_founder: false,
      provider_verified: false,
      entitlement_persisted: true,
      activated: true,
    });
    mark(
      "inconsistent_economic_records",
      demo.payment === "simulated" &&
        demo.recognized_revenue === "blocked" &&
        demo.entitlement === "blocked" &&
        founder.recognized_revenue === "blocked" &&
        unverified.payment === "unknown" &&
        unverified.entitlement === "blocked" &&
        unverified.recognized_revenue === "blocked"
    );
  } catch {
    mark("inconsistent_economic_records", false);
  }

  try {
    const log = new ContinuityLog();
    const row = attemptAction(
      log,
      baseInput("act_secret", "secret-1", "inspect", agent, {
        secret_required: true,
        secret_present: false,
      }),
      T0
    );
    mark(
      "secret_unavailable",
      row.action.state === "blocked" &&
        row.action.error_class === "secret_unavailable"
    );
  } catch {
    mark("secret_unavailable", false);
  }

  try {
    const log = new ContinuityLog();
    const started = attemptAction(
      log,
      baseInput("act_sched", "sched-1", "retry_idempotent", agent),
      T0
    );
    beginExecution(log, started.action.action_id, agent, T0, LEASE_MS);
    recover(log, at(LEASE_MS + 1), { actor: "recovery", rng: () => 0 });
    const waiting = log.ledger.get("act_sched");
    const second = recover(log, at(LEASE_MS + 1), {
      actor: "recovery",
      rng: () => 0,
    });
    mark(
      "scheduler_unavailable",
      waiting?.state === "retryable_failure" &&
        waiting.next_retry_at != null &&
        waiting.next_retry_at > at(LEASE_MS + 1).toISOString() &&
        second.requeued === 0 &&
        log.ledger.get("act_sched")?.state === "retryable_failure"
    );
  } catch {
    mark("scheduler_unavailable", false);
  }

  try {
    const log = new ContinuityLog();
    const started = attemptAction(
      log,
      baseInput("act_exhaust", "exhaust-1", "retry_idempotent", agent, {
        retry_count: 5,
      }),
      T0
    );
    beginExecution(log, started.action.action_id, agent, T0, LEASE_MS);
    recover(log, at(LEASE_MS + 1), {
      actor: "recovery",
      maxRetries: 5,
      rng: () => 0,
    });
    mark(
      "retry_exhaustion",
      log.ledger.get("act_exhaust")?.state === "permanent_failure"
    );
  } catch {
    mark("retry_exhaustion", false);
  }

  try {
    mark(
      "redaction",
      redactDetail("token sk_live_EXAMPLEVALUE and whsec_EXAMPLE") ===
        "token [redacted] and [redacted]"
    );
  } catch {
    mark("redaction", false);
  }

  try {
    const log = new ContinuityLog();
    const created = attemptAction(
      log,
      baseInput("act_hist", "hist-1", "inspect", agent),
      T0
    );
    log.ledger.transition(
      created.action.action_id,
      "cancelled",
      { measurement_result: "not a rewrite" },
      agent.agent_id,
      "cancel",
      at(1)
    );
    const row = log.ledger.get("act_hist");
    mark(
      "history_append_only",
      row?.history.length === 3 &&
        row.history[0]?.to === "queued" &&
        row.history[2]?.to === "cancelled"
    );
  } catch {
    mark("history_append_only", false);
  }

  return faults;
}

export function runFounderExitDrill(filePath?: string): FounderExitReport {
  const log = new ContinuityLog();
  const agentA: AgentIdentity = {
    agent_id: "agent-a",
    identity_version: "1",
    capabilities: ["retry_idempotent", "inspect"],
    revoked: false,
  };
  const agentB: AgentIdentity = {
    agent_id: "agent-b",
    identity_version: "1",
    capabilities: ["retry_idempotent", "inspect", "send_outbound", "charge"],
    revoked: false,
  };

  const continued = attemptAction(
    log,
    baseInput("act_continue", "continue-1", "inspect", agentA),
    T0
  );
  const interrupted = attemptAction(
    log,
    baseInput("act_interrupt", "effect-1", "retry_idempotent", agentA),
    T0
  );
  const resumable = attemptAction(
    log,
    baseInput("act_resume", "resume-1", "retry_idempotent", agentA),
    at(1)
  );
  beginExecution(log, interrupted.action.action_id, agentA, at(2), LEASE_MS);
  log.recordSideEffect("effect-1");

  const recovery = recover(log, at(LEASE_MS + 1000), {
    actor: "recovery",
    rng: () => 0,
  });
  const again = log.recordSideEffect("effect-1");
  const finalRow = log.ledger.get("act_interrupt");

  const revokedA: AgentIdentity = { ...agentA, revoked: true };
  const denied = attemptAction(
    log,
    baseInput("act_denied", "denied-1", "inspect", revokedA),
    at(LEASE_MS + 2000)
  );
  let revokedCannotStart = false;
  try {
    beginExecution(
      log,
      resumable.action.action_id,
      revokedA,
      at(LEASE_MS + 2000),
      LEASE_MS
    );
  } catch (err) {
    revokedCannotStart = err instanceof Error && err.message === "revoked";
  }
  const resumed = resumeWithAgent(
    log,
    resumable.action.action_id,
    agentB,
    at(LEASE_MS + 3000),
    LEASE_MS
  );
  const blockedSend = attemptAction(
    log,
    baseInput("act_send", "send-1", "send_outbound", agentB),
    at(LEASE_MS + 4000)
  );
  const blockedCharge = attemptAction(
    log,
    baseInput("act_charge", "charge-1", "charge", agentB),
    at(LEASE_MS + 4000)
  );

  const restartPath =
    filePath ?? join(tmpdir(), `founder-exit-${process.pid}.json`);
  let fileApplications = -1;
  try {
    const fileLog = new FileContinuityLog(restartPath);
    const fileAction = attemptAction(
      fileLog,
      baseInput("act_file", "file-effect-1", "retry_idempotent", agentA),
      T0
    );
    beginExecution(fileLog, fileAction.action.action_id, agentA, T0, LEASE_MS);
    fileLog.recordSideEffect("file-effect-1");
    const reloaded = new FileContinuityLog(restartPath);
    recover(reloaded, at(LEASE_MS + 1000), { actor: "recovery", rng: () => 0 });
    reloaded.recordSideEffect("file-effect-1");
    fileApplications = reloaded.effects.applications;
  } finally {
    if (existsSync(restartPath)) unlinkSync(restartPath);
  }

  const economic = {
    demo_zero: classifyEconomicEvidence({
      amount_cents: 0,
      is_demo: true,
      is_founder: false,
      provider_verified: true,
      entitlement_persisted: true,
      activated: false,
    }),
    founder_1000: classifyEconomicEvidence({
      amount_cents: 1000,
      is_demo: false,
      is_founder: true,
      provider_verified: true,
      entitlement_persisted: false,
      activated: false,
    }),
    unverified_entitlement: classifyEconomicEvidence({
      amount_cents: 29900,
      is_demo: false,
      is_founder: false,
      provider_verified: false,
      entitlement_persisted: true,
      activated: true,
    }),
  };

  const faults = runFaults();
  const snapshot = continuitySnapshot(log);
  const criteria: Record<string, "pass" | "fail"> = {
    durability: finalRow?.state === "succeeded" ? "pass" : "fail",
    recoverability: recovery.reconciled === 1 ? "pass" : "fail",
    idempotency:
      again === "duplicate" && log.effects.applications === 1 ? "pass" : "fail",
    auditability:
      (finalRow?.history.length ?? 0) >= 4 &&
      finalRow?.history[0]?.to === "queued" &&
      finalRow?.policy_version === POLICY_VERSION
        ? "pass"
        : "fail",
    unrelated_work_continues:
      log.ledger.get("act_continue")?.state === "authorized" ? "pass" : "fail",
    revocation:
      denied.action.state === "denied" && revokedCannotStart ? "pass" : "fail",
    replacement:
      resumed.state === "running" && resumed.lease_owner === "agent-b"
        ? "pass"
        : "fail",
    no_unapproved_production:
      blockedSend.action.state === "blocked" &&
      blockedCharge.action.state === "blocked" &&
      log.effects.applications === 1
        ? "pass"
        : "fail",
    blockers_remain_visible: snapshot.blocked.length >= 2 ? "pass" : "fail",
    file_restart_no_duplicate: fileApplications === 1 ? "pass" : "fail",
    economic_separation:
      economic.demo_zero.recognized_revenue === "blocked" &&
      economic.demo_zero.entitlement === "blocked" &&
      economic.founder_1000.recognized_revenue === "blocked" &&
      economic.unverified_entitlement.entitlement === "blocked" &&
      economic.unverified_entitlement.recognized_revenue === "blocked"
        ? "pass"
        : "fail",
    faults: Object.values(faults).every(value => value === "pass")
      ? "pass"
      : "fail",
  };

  return {
    drill_id: "founder-exit-2026-10-13",
    environment: "isolated_memory_and_temp_file",
    production_side_effects: false,
    stripe_called: false,
    mail_sent: false,
    migration_applied: false,
    policy_version: POLICY_VERSION,
    generated_at: at(LEASE_MS + 4000).toISOString(),
    action_ids: {
      interrupted: "act_interrupt",
      continued: continued.action.action_id,
      denied_after_revocation: denied.action.action_id,
      resumed_by_replacement: resumed.action_id,
      blocked_send: blockedSend.action.action_id,
      blocked_charge: blockedCharge.action.action_id,
    },
    idempotency_key: "effect-1",
    side_effect_applications: log.effects.applications,
    duplicate_side_effects: log.effects.duplicates,
    recovery_outcome: "reconciled_existing_side_effect",
    final_state: finalRow?.state ?? "queued",
    verification_status: finalRow?.verification_status ?? "unknown",
    file_restart_applications: fileApplications,
    revoked_agent_denied: denied.action.state === "denied",
    replacement_resumed: resumed.lease_owner === "agent-b",
    unapproved_production_operations: 0,
    open_blockers: snapshot.blocked,
    economic,
    faults,
    criteria,
  };
}
