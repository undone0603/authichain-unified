/**
 * Port of src/app/api/guardrail/{check,record,suppress} onto the edge
 * router. app.authichain.com is authichain-edge-router now (Vercel is gone);
 * without these routes the B2B workflow gets HTTP 404 and treats it as a
 * send failure.
 */
import type { Context, Hono } from "hono";
import { timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";
import {
  addSuppressionWithSupabase,
  checkAndReserveWithSupabase,
  recordEventWithSupabase,
  type GuardrailAdmin,
} from "../shared/guardrail-store";

export type GuardrailEnv = {
  INTERNAL_API_SECRET?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function timingSafeEqualStrings(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return cryptoTimingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function requireInternalSecret(c: Context<{ Bindings: GuardrailEnv }>) {
  const secret = c.env?.INTERNAL_API_SECRET ?? process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return c.json({ error: "INTERNAL_API_SECRET not configured" }, 503);
  }
  const bearer =
    c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const internal = c.req.header("x-internal-secret") ?? "";
  const provided = internal || bearer;
  if (!provided || !timingSafeEqualStrings(provided, secret)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return null;
}

async function supabaseAdmin(
  env?: GuardrailEnv
): Promise<GuardrailAdmin | null> {
  const url =
    env?.SUPABASE_URL ||
    env?.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key);
}

const validActions = ["check", "record", "suppress", "kill_toggle"] as const;

export function registerGuardrailApi<
  E extends GuardrailEnv,
  V extends Record<string, unknown> = Record<string, never>,
>(app: Hono<{ Bindings: E; Variables: V }>): void {
  app.post("/api/guardrail/check", async c => {
    const denied = requireInternalSecret(c);
    if (denied) return denied;

    let body: { channel?: string; count?: number; recipient?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    if (!body.channel || typeof body.channel !== "string") {
      return c.json({ error: "channel is required" }, 400);
    }

    const admin = await supabaseAdmin(c.env);
    if (!admin) {
      return c.json(
        { allowed: false, remaining: 0, reason: "Supabase not configured" },
        503
      );
    }

    try {
      const result = await checkAndReserveWithSupabase(
        admin,
        body.channel,
        body.count ?? 1,
        body.recipient
      );
      return c.json(result);
    } catch (err) {
      console.error("[guardrail/check] failed:", err);
      return c.json(
        { allowed: false, remaining: 0, reason: "internal error" },
        500
      );
    }
  });

  app.post("/api/guardrail/record", async c => {
    const denied = requireInternalSecret(c);
    if (denied) return denied;

    let body: {
      channel?: string;
      action?: string;
      allowed?: boolean;
      reason?: string;
      metadata?: Record<string, unknown>;
    };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    if (!body.channel || !body.action) {
      return c.json({ error: "channel and action are required" }, 400);
    }
    if (!validActions.includes(body.action as (typeof validActions)[number])) {
      return c.json(
        {
          error: "action must be one of: check, record, suppress, kill_toggle",
        },
        400
      );
    }

    const admin = await supabaseAdmin(c.env);
    if (!admin) {
      return c.json({ ok: false, error: "Supabase not configured" }, 503);
    }

    try {
      await recordEventWithSupabase(admin, {
        channel: body.channel,
        action: body.action as (typeof validActions)[number],
        allowed: body.allowed,
        reason: body.reason,
        metadata: body.metadata,
      });
      return c.json({ ok: true });
    } catch (err) {
      console.error("[guardrail/record] failed:", err);
      return c.json({ ok: false, error: "internal error" }, 500);
    }
  });

  app.post("/api/guardrail/suppress", async c => {
    const denied = requireInternalSecret(c);
    if (denied) return denied;

    let body: { email?: string; reason?: string; source?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    if (!body.email || !body.reason || !body.source) {
      return c.json({ error: "email, reason, and source are required" }, 400);
    }

    const admin = await supabaseAdmin(c.env);
    if (!admin) {
      return c.json({ ok: false, error: "Supabase not configured" }, 503);
    }

    try {
      await addSuppressionWithSupabase(
        admin,
        body.email,
        body.reason,
        body.source
      );
      await recordEventWithSupabase(admin, {
        channel: body.source,
        action: "suppress",
        reason: body.reason,
        metadata: { email: body.email },
      });
      return c.json({ ok: true });
    } catch (err) {
      console.error("[guardrail/suppress] failed:", err);
      return c.json({ ok: false, error: "internal error" }, 500);
    }
  });
}
