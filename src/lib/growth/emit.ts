/**
 * Growth loop event emitter — implements the instrumentation contract in
 * docs/growth/2026-09-28-first-dollar-loops.md:
 *
 *   Fire the event names in src/lib/growth/loops.ts with
 *   { loop, sku, email_hash?, founder: boolean }
 *
 * Two rules this module exists to enforce:
 *
 * 1. Raw email never leaves the caller. Only a SHA-256 hex digest is emitted,
 *    so abandoned-checkout recovery can correlate a session without the event
 *    store holding addresses.
 * 2. Founder traffic is labelled at emit time via isFounderEmail, because the
 *    kill criteria in every loop are stated in terms of NON-founder purchases.
 *    An unlabelled founder purchase would read as first-stranger revenue.
 *
 * Separate from src/lib/funnel-tracking.ts on purpose: that module tracks
 * identified outbound prospects (prospect_id, proposal_sent, email_opened).
 * These loops are anonymous, self-serve and inbound.
 */
import { isFounderEmail } from "../billing/live-catalog";
import { GROWTH_LOOPS, type GrowthEvent, type GrowthLoop, type GrowthLoopId } from "./loops";

export type GrowthSku = GrowthLoop["sku"];

/** Wire format accepted by POST /api/growth. */
export interface GrowthEventPayload {
  event: GrowthEvent;
  loop: GrowthLoopId;
  sku: GrowthSku;
  /** SHA-256 hex of the lowercased, trimmed email. Absent for anonymous events. */
  email_hash?: string;
  /** True when the email is a founder address. Excluded from conversion math. */
  founder: boolean;
  /** ISO-8601, set by the caller so queued events keep their real time. */
  occurred_at: string;
}

const EVENT_TO_LOOPS = new Map<GrowthEvent, GrowthLoopId[]>();
for (const loop of GROWTH_LOOPS) {
  for (const event of loop.events) {
    const existing = EVENT_TO_LOOPS.get(event);
    if (existing) existing.push(loop.id);
    else EVENT_TO_LOOPS.set(event, [loop.id]);
  }
}

/** Every event name declared by at least one loop. */
export function isGrowthEvent(value: string): value is GrowthEvent {
  return EVENT_TO_LOOPS.has(value as GrowthEvent);
}

/**
 * Some events (checkout_abandoned, checkout_email_captured) are shared by more
 * than one loop, so the sku is what disambiguates them.
 */
export function loopForEvent(event: GrowthEvent, sku: GrowthSku): GrowthLoopId | null {
  const candidates = EVENT_TO_LOOPS.get(event);
  if (!candidates || candidates.length === 0) return null;
  const match = GROWTH_LOOPS.find(l => l.sku === sku && candidates.includes(l.id));
  return match ? match.id : null;
}

/** SHA-256 hex. Available in Workers, browsers and Node 18+. */
export async function hashEmail(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim();
  const bytes = new TextEncoder().encode(normalized);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export class GrowthEventError extends Error {}

/**
 * Build a validated payload. Throws rather than emitting a malformed event,
 * because a silently mislabelled purchase corrupts the kill decision.
 */
export async function buildGrowthEvent(input: {
  event: GrowthEvent;
  sku: GrowthSku;
  email?: string | null;
  occurredAt?: Date;
}): Promise<GrowthEventPayload> {
  if (!isGrowthEvent(input.event)) {
    throw new GrowthEventError(`Unknown growth event: ${input.event}`);
  }

  const loop = loopForEvent(input.event, input.sku);
  if (!loop) {
    throw new GrowthEventError(
      `Event ${input.event} is not declared for sku ${input.sku} in GROWTH_LOOPS`,
    );
  }

  const email = input.email == null ? "" : input.email.trim();
  const payload: GrowthEventPayload = {
    event: input.event,
    loop,
    sku: input.sku,
    founder: email.length > 0 && isFounderEmail(email),
    occurred_at: (input.occurredAt ?? new Date()).toISOString(),
  };

  if (email.length > 0) payload.email_hash = await hashEmail(email);
  return payload;
}

/**
 * Fire-and-forget emit. Never throws and never blocks a checkout: a dropped
 * analytics event must not cost a sale. Returns whether it was recorded.
 */
export async function emitGrowthEvent(input: {
  event: GrowthEvent;
  sku: GrowthSku;
  email?: string | null;
  occurredAt?: Date;
  /** Override for Workers/server callers that cannot use a relative URL. */
  endpoint?: string;
}): Promise<{ ok: boolean; error?: string }> {
  let payload: GrowthEventPayload;
  try {
    payload = await buildGrowthEvent(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid growth event";
    console.error("[growth] refusing to emit:", message);
    return { ok: false, error: message };
  }

  try {
    const res = await fetch(input.endpoint ?? "/api/growth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (!res.ok) return { ok: false, error: `ingest responded ${res.status}` };
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "network error";
    console.error("[growth] emit failed:", message);
    return { ok: false, error: message };
  }
}
