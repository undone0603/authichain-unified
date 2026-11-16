import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { getWebhookSupabase } from "../../stripe/webhook/supabase";
import {
  authorizedAttestationRequest,
  matchesExpectedDatabase,
  safeIdentityFingerprint,
  validRuntimeAttestationPins,
} from "../../../../lib/runtime-db-attestation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const headers = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  "Surrogate-Control": "no-store",
  Pragma: "no-cache",
  Vary: "Authorization",
  "X-Content-Type-Options": "nosniff",
};

function reply(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers });
}

/** Read through the application's actual postgres-js DATABASE_URL singleton. */
async function readPostgresInstance(): Promise<unknown> {
  const result = await getDb().execute(
    sql`SELECT public.attest_runtime_database_identity() AS identity`,
  );
  const rows = Array.isArray(result)
    ? result
    : (result as unknown as { rows?: Array<{ identity?: unknown }> }).rows;
  return rows?.[0]?.identity;
}

/** Read through precisely the same Supabase service-role client as the webhook. */
async function readWebhookInstance(): Promise<unknown> {
  const { data, error } = await getWebhookSupabase().rpc(
    "attest_runtime_database_identity",
  );
  if (error) throw new Error("supabase_identity_probe_unavailable");
  return data;
}

/**
 * No public health details or fallback database targets. Missing pin, missing
 * migration, permission error, stale credential, or a split-brain target all
 * fail closed without exposing any URL, key, cluster ID or connection error.
 */
export async function GET(request: Request) {
  if (!authorizedAttestationRequest(request, process.env.RUNTIME_ATTESTATION_KEY)) {
    return reply({ verified: false, error: "unauthorized" }, 401);
  }

  const checkedAt = new Date().toISOString();
  const pins = {
    expectedSystemId: process.env.RUNTIME_EXPECTED_DB_SYSTEM_IDENTIFIER ?? "",
    expectedDatabaseName: process.env.RUNTIME_EXPECTED_DATABASE_NAME ?? "",
    expectedProjectRef: process.env.RUNTIME_EXPECTED_SUPABASE_PROJECT_REF ?? "",
    deployedSha:
      process.env.AUTHICHAIN_DEPLOYED_SHA ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      "",
  };
  if (!validRuntimeAttestationPins(pins, process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    return reply({ verified: false, error: "attestation_unavailable", checkedAt }, 503);
  }

  const probes = await Promise.allSettled([
    readPostgresInstance(),
    readWebhookInstance(),
  ]);
  const postgresValid =
    probes[0].status === "fulfilled" &&
    matchesExpectedDatabase(probes[0].value, pins.expectedSystemId, pins.expectedDatabaseName);
  const webhookValid =
    probes[1].status === "fulfilled" &&
    matchesExpectedDatabase(probes[1].value, pins.expectedSystemId, pins.expectedDatabaseName);

  if (!postgresValid || !webhookValid) {
    return reply({ verified: false, error: "attestation_unavailable", checkedAt }, 503);
  }

  // Return only a digest of the independently pinned identity. No raw system ID.
  const identity = safeIdentityFingerprint(pins.expectedSystemId, pins.expectedDatabaseName);
  return reply(
    {
      verified: true,
      deployedVersion: pins.deployedSha,
      checkedAt,
      connections: {
        databaseUrl: {
          path: "postgres-js:getDb",
          identity,
          verified: true,
        },
        webhookSupabase: {
          path: "stripe-webhook:supabase-js",
          identity,
          verified: true,
        },
      },
    },
    200,
  );
}
