import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AttestationIssuer,
  AttestationStatusRecord,
  IssuerStatus,
} from "../protocol/attestation/trust-registry";

export type AttestationRegistryEnv = {
  SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
};

type IssuerRow = {
  issuer_id: string;
  organization: string;
  jurisdiction: string | null;
  issuer_type: AttestationIssuer["issuerType"];
  jwks_uri: string;
  status: IssuerStatus;
  valid_from: string;
  valid_until: string | null;
  authority_uri: string | null;
};

type StatusRow = {
  attestation_id: string;
  claim_status: AttestationStatusRecord["claimStatus"];
  effective_at: string;
  reason_code: string | null;
  issuer_id: string;
  event_id: string;
};

function clientFor(env: AttestationRegistryEnv): SupabaseClient | null {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function mapIssuer(row: IssuerRow): AttestationIssuer {
  return {
    issuerId: row.issuer_id,
    organization: row.organization,
    ...(row.jurisdiction ? { jurisdiction: row.jurisdiction } : {}),
    issuerType: row.issuer_type,
    jwksUri: row.jwks_uri,
    status: row.status,
    validFrom: row.valid_from,
    ...(row.valid_until ? { validUntil: row.valid_until } : {}),
    ...(row.authority_uri ? { authorityUri: row.authority_uri } : {}),
  };
}

export async function getIssuer(
  env: AttestationRegistryEnv,
  issuerId: string,
): Promise<{ ok: true; issuer: AttestationIssuer } | { ok: false; status: number; error: string }> {
  const db = clientFor(env);
  if (!db) return { ok: false, status: 503, error: "attestation registry unavailable" };

  const { data, error } = await db
    .from("attestation_issuers")
    .select("issuer_id,organization,jurisdiction,issuer_type,jwks_uri,status,valid_from,valid_until,authority_uri")
    .eq("issuer_id", issuerId)
    .maybeSingle();

  if (error) return { ok: false, status: 503, error: "attestation registry unavailable" };
  if (!data) return { ok: false, status: 404, error: "issuer not found" };

  return { ok: true, issuer: mapIssuer(data as IssuerRow) };
}

export async function getCurrentAttestationStatus(
  env: AttestationRegistryEnv,
  attestationId: string,
): Promise<{ ok: true; status: AttestationStatusRecord | null } | { ok: false; status: number; error: string }> {
  const db = clientFor(env);
  if (!db) return { ok: false, status: 503, error: "attestation registry unavailable" };

  const { data, error } = await db
    .from("attestation_current_status")
    .select("attestation_id,claim_status,effective_at,reason_code,issuer_id,event_id")
    .eq("attestation_id", attestationId)
    .maybeSingle();

  if (error) return { ok: false, status: 503, error: "attestation registry unavailable" };
  if (!data) return { ok: true, status: null };

  const row = data as StatusRow;
  return {
    ok: true,
    status: {
      attestationId: row.attestation_id,
      claimStatus: row.claim_status,
      effectiveAt: row.effective_at,
      ...(row.reason_code ? { reasonCode: row.reason_code } : {}),
      issuerId: row.issuer_id,
      eventId: row.event_id,
    },
  };
}

export async function recordStatusEvent(
  env: AttestationRegistryEnv,
  input: {
    eventType: "attestation.issued" | "attestation.revoked" | "attestation.expired" | "attestation.superseded";
    attestationId: string;
    issuerId: string;
    reasonCode?: string;
    subjectHash?: string;
    evidenceDigest?: string;
    idempotencyKey?: string;
    supersedesAttestationId?: string;
  },
): Promise<{ ok: true; eventId: string } | { ok: false; status: number; error: string }> {
  const db = clientFor(env);
  if (!db) return { ok: false, status: 503, error: "attestation registry unavailable" };

  const { data, error } = await db
    .from("attestation_status_events")
    .insert({
      event_type: input.eventType,
      attestation_id: input.attestationId,
      issuer_id: input.issuerId,
      reason_code: input.reasonCode || null,
      subject_hash: input.subjectHash || null,
      evidence_digest: input.evidenceDigest || null,
      idempotency_key: input.idempotencyKey || null,
      supersedes_attestation_id: input.supersedesAttestationId || null,
    })
    .select("event_id")
    .single();

  if (error || !data) return { ok: false, status: 503, error: "attestation status write failed" };
  return { ok: true, eventId: String((data as { event_id: string }).event_id) };
}
