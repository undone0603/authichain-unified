/**
 * Supabase-backed guardrail check/record/suppress.
 *
 * The Next.js `/api/guardrail/*` routes died with Vercel. Live callers
 * (b2b-cold-outreach, qron-outreach) still POST
 * `https://app.authichain.com/api/guardrail/check` — that hostname is now
 * `authichain-edge-router` (worker-app), which must speak the same protocol
 * against the same tables. Actions can also call these helpers directly when
 * the HTTP path 404s (deploy lag) or 5xxs (missing Worker INTERNAL_API_SECRET).
 */

export type GuardrailCheckResult = {
  allowed: boolean;
  remaining: number;
  reason?: string;
};

export type GuardrailRecordInput = {
  channel: string;
  action: "check" | "record" | "suppress" | "kill_toggle";
  allowed?: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
};

/** Minimal surface of supabase-js used here — keeps tests off the real client. */
export type GuardrailAdmin = {
  from: (table: string) => any;
};

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export const B2B_CHANNEL = "email.b2b-cold";
export const B2B_DAILY_CAP = 25;

export async function checkAndReserveWithSupabase(
  admin: GuardrailAdmin,
  channelName: string,
  count = 1,
  recipient?: string
): Promise<GuardrailCheckResult> {
  const { data: globalKill } = await admin
    .from("kill_switches")
    .select("enabled, reason")
    .eq("scope", "global")
    .maybeSingle();
  if (globalKill?.enabled) {
    return {
      allowed: false,
      remaining: 0,
      reason: "global kill switch engaged",
    };
  }

  if (!Number.isInteger(count) || count < 1) {
    return { allowed: false, remaining: 0, reason: "invalid count" };
  }

  const { data: channel } = await admin
    .from("guardrail_channels")
    .select("id, name, daily_cap, enabled")
    .eq("name", channelName)
    .maybeSingle();
  if (!channel) {
    return {
      allowed: false,
      remaining: 0,
      reason: `unknown channel: ${channelName}`,
    };
  }
  if (!channel.enabled) {
    return { allowed: false, remaining: 0, reason: "channel disabled" };
  }

  const { data: channelKill } = await admin
    .from("kill_switches")
    .select("enabled, reason")
    .eq("scope", channelName)
    .maybeSingle();
  if (channelKill?.enabled) {
    return {
      allowed: false,
      remaining: 0,
      reason: `channel kill switch engaged: ${channelKill.reason ?? "no reason given"}`,
    };
  }

  if (recipient) {
    const { data: suppressed } = await admin
      .from("guardrail_suppression_list")
      .select("reason")
      .eq("email", recipient.toLowerCase())
      .maybeSingle();
    if (suppressed) {
      return {
        allowed: false,
        remaining: 0,
        reason: `recipient suppressed: ${suppressed.reason}`,
      };
    }
  }

  const cap = Number(channel.daily_cap);
  if (count > cap) {
    return {
      allowed: false,
      remaining: 0,
      reason: "requested count exceeds daily cap",
    };
  }

  const today = todayUtc();
  await admin
    .from("guardrail_counters")
    .upsert(
      { channel_id: channel.id, day: today, count: 0 },
      { onConflict: "channel_id,day", ignoreDuplicates: true }
    );

  const { data: current } = await admin
    .from("guardrail_counters")
    .select("id, count")
    .eq("channel_id", channel.id)
    .eq("day", today)
    .maybeSingle();

  const used = Number(current?.count ?? 0);
  if (used + count > cap) {
    return { allowed: false, remaining: 0, reason: "daily cap reached" };
  }

  const { data: updated } = await admin
    .from("guardrail_counters")
    .update({ count: used + count })
    .eq("id", current.id)
    .eq("count", used)
    .select("count")
    .maybeSingle();

  if (!updated) {
    return { allowed: false, remaining: 0, reason: "daily cap reached" };
  }
  return { allowed: true, remaining: cap - Number(updated.count) };
}

export async function recordEventWithSupabase(
  admin: GuardrailAdmin,
  input: GuardrailRecordInput
): Promise<void> {
  const { data: channel } = await admin
    .from("guardrail_channels")
    .select("id")
    .eq("name", input.channel)
    .maybeSingle();
  await admin.from("guardrail_events").insert({
    channel_id: channel?.id ?? null,
    action: input.action,
    allowed: input.allowed ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });
}

export async function addSuppressionWithSupabase(
  admin: GuardrailAdmin,
  email: string,
  reason: string,
  source: string
): Promise<void> {
  await admin
    .from("guardrail_suppression_list")
    .upsert(
      { email: email.toLowerCase(), reason, source },
      { onConflict: "email", ignoreDuplicates: true }
    );
}

/**
 * Live B2B send is gated by OWNER_LIVE_SEND in the workflow. The channel row
 * was seeded disabled as a second latch from before that var existed — flip
 * it on (cap 25/day) so a live run can actually reserve.
 */
export async function ensureLiveB2bChannel(
  admin: GuardrailAdmin
): Promise<void> {
  await admin.from("guardrail_channels").upsert(
    {
      name: B2B_CHANNEL,
      category: "email",
      daily_cap: B2B_DAILY_CAP,
      enabled: true,
      spend_ceiling_cents: 0,
      description:
        "scripts/b2b-cold-outreach.ts weekly cold outreach — enabled when OWNER_LIVE_SEND=true live runs need a reservable cap.",
    },
    { onConflict: "name" }
  );
}
