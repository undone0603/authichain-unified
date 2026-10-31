/**
 * One vocabulary for the events that let someone reconstruct what happened on
 * the trust and money paths, without exposing secrets or personal data.
 *
 * Each event is a single JSON log line, `{"schema":"authichain.trust-event/1",
 * "event":"attestation.verified", ...}`, so Workers Logs / tail / any log
 * drain can filter on it. Fields are allowlisted: anything not listed below
 * is dropped, so a caller cannot leak a JWS, an email address, a key or an
 * amount by passing it in. Emitting never throws.
 */

export const TRUST_EVENT_SCHEMA = "authichain.trust-event/1";

export const TRUST_EVENTS = [
  "attestation.created",
  "attestation.verified",
  "attestation.rejected",
  "attestation.revoked",
  "attestation.superseded",
  "identifier.resolved",
  "dpp.created",
  "checkout.started",
  "payment.verified",
  "fulfillment.started",
  "fulfillment.completed",
  "fulfillment.failed",
  "entitlement.granted",
  "agent.action.proposed",
  "agent.action.executed",
  "agent.action.denied",
  "policy.blocked",
  "human_hold.triggered",
  "recovery.started",
  "recovery.completed",
] as const;

export type TrustEventName = (typeof TRUST_EVENTS)[number];

const STRING_FIELDS = [
  "attestation_id",
  "issuer_id",
  "subject_object_id",
  "kid",
  "key_status",
  "decision",
  "claim_status",
  "event_id",
  "reason_code",
  "route",
  "session_id",
  "profile_id",
  "plan",
  "agent_id",
  "capability",
  "intent",
  "error_class",
  "outcome",
] as const;

type StringField = (typeof STRING_FIELDS)[number];

export type TrustEventFields = Partial<Record<StringField, string | null>> & {
  valid?: boolean;
  demo?: boolean;
  http_status?: number;
  reasons?: readonly string[];
};

export type TrustEventRecord = {
  schema: typeof TRUST_EVENT_SCHEMA;
  event: TrustEventName;
  at: string;
} & TrustEventFields;

const MAX_STRING = 200;
const EMAIL_LIKE = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[^\s@<>"'(),;:]+/;

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v || EMAIL_LIKE.test(v)) return null;
  // A compact JWS or anything long enough to be a token is never a label.
  if (/^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+$/.test(v)) return null;
  return v.slice(0, MAX_STRING);
}

export function isTrustEventName(name: string): name is TrustEventName {
  return (TRUST_EVENTS as readonly string[]).includes(name);
}

/** Pure: build the record that would be logged. Unknown fields are dropped. */
export function trustEvent(
  name: TrustEventName,
  fields: TrustEventFields & Record<string, unknown> = {},
  now: Date = new Date(),
): TrustEventRecord {
  const out: TrustEventRecord = { schema: TRUST_EVENT_SCHEMA, event: name, at: now.toISOString() };
  for (const key of STRING_FIELDS) {
    const v = clean(fields[key]);
    if (v !== null) (out as Record<string, unknown>)[key] = v;
  }
  if (typeof fields.valid === "boolean") out.valid = fields.valid;
  if (typeof fields.demo === "boolean") out.demo = fields.demo;
  if (typeof fields.http_status === "number" && Number.isInteger(fields.http_status)) {
    out.http_status = fields.http_status;
  }
  if (Array.isArray(fields.reasons)) {
    out.reasons = fields.reasons
      .map(r => clean(r))
      .filter((r): r is string => r !== null)
      .slice(0, 10);
  }
  return out;
}

export type TrustEventSink = (line: string) => void;

const defaultSink: TrustEventSink = line => console.log(line);

/** Log one trust event. Never throws: observability must not break the path it observes. */
export function emitTrustEvent(
  name: TrustEventName,
  fields: TrustEventFields & Record<string, unknown> = {},
  sink: TrustEventSink = defaultSink,
): void {
  try {
    sink(JSON.stringify(trustEvent(name, fields)));
  } catch {
    /* swallow: see above */
  }
}
