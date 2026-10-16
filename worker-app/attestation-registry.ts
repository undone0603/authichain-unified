import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AttestationIssuer,
  AttestationStatusRecord,
  IssuerStatus,
} from "../protocol/attestation/trust-registry";
import type { AuthiChainAttestationV01 } from "../packages/verifier/src/index";

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

export type PublishAttestationRecordInput = {
  sealId: string;
  attestation: AuthiChainAttestationV01;
  issuerKid: string;
  jws: string;
  recordHash: string;
  subjectHash: string;
  evidenceDigest: string;
};

type SealForPublication = {
  id: string;
  product_id: string;
  batch_id: string | null;
  brand: string;
};

export type PublishAttestationRecordResult =
  | {
      ok: true;
      eventId: string;
      alreadyPublished: boolean;
      seal: SealForPublication;
    }
  | { ok: false; status: number; error: string };

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

  const row = {
    event_type: input.eventType,
    attestation_id: input.attestationId,
    issuer_id: input.issuerId,
    reason_code: input.reasonCode || null,
    subject_hash: input.subjectHash || null,
    evidence_digest: input.evidenceDigest || null,
    idempotency_key: input.idempotencyKey || null,
    supersedes_attestation_id: input.supersedesAttestationId || null,
  };
  if (input.idempotencyKey) {
    const { error: upsertError } = await db
      .from("attestation_status_events")
      .upsert(row, { onConflict: "issuer_id,idempotency_key", ignoreDuplicates: true });
    if (upsertError) return { ok: false, status: 503, error: "attestation status write failed" };
    const { data: existing, error: lookupError } = await db
      .from("attestation_status_events")
      .select("event_id")
      .eq("issuer_id", input.issuerId)
      .eq("idempotency_key", input.idempotencyKey)
      .single();
    if (lookupError || !existing) return { ok: false, status: 503, error: "attestation status write failed" };
    return { ok: true, eventId: String((existing as { event_id: string }).event_id) };
  }

  const { data, error } = await db
    .from("attestation_status_events")
    .insert(row)
    .select("event_id")
    .single();
  if (error || !data) return { ok: false, status: 503, error: "attestation status write failed" };
  return { ok: true, eventId: String((data as { event_id: string }).event_id) };
}

/**
 * Publish an authenticated, issuer-signed v0.1 attestation for an existing
 * auth_seals row. The complete JWS is kept in the separate versioned record
 * table; the old seal/QR registration is never upgraded into a signed record
 * without this route. Public visibility is flipped only after the append-only
 * attestation.issued event has been durably recorded.
 */
export async function publishAttestationRecord(
  env: AttestationRegistryEnv,
  input: PublishAttestationRecordInput,
): Promise<PublishAttestationRecordResult> {
  const db = clientFor(env);
  if (!db) {
    return { ok: false, status: 503, error: "attestation registry unavailable" };
  }

  const { data: rawSeal, error: sealError } = await db
    .from("auth_seals")
    .select("id,product_id,batch_id,brand")
    .eq("id", input.sealId)
    .maybeSingle();
  if (sealError) {
    return { ok: false, status: 503, error: "seal registry unavailable" };
  }
  if (!rawSeal) {
    return { ok: false, status: 404, error: "seal not found" };
  }

  const seal = rawSeal as SealForPublication;
  const attestation = input.attestation;
  if (attestation.subject.object_id !== seal.product_id) {
    return {
      ok: false,
      status: 409,
      error: "attestation object_id does not match the registered product_id",
    };
  }
  if ((attestation.subject.lot ?? null) !== (seal.batch_id ?? null)) {
    return {
      ok: false,
      status: 409,
      error: "attestation lot does not match the registered batch_id",
    };
  }
  if (attestation.issuer.id !== "https://authichain.com") {
    return { ok: false, status: 409, error: "unsupported publishing issuer" };
  }

  const table = "authichain_attestation_records";
  const { data: existingRaw, error: existingError } = await db
    .from(table)
    .select("attestation_id,seal_id,product_id,batch_id,brand,jws,record_hash,published")
    .eq("attestation_id", attestation.attestation_id)
    .maybeSingle();
  if (existingError) {
    return {
      ok: false,
      status: 503,
      error: "signed-record registry unavailable; apply the signed-record migration",
    };
  }

  let existing = existingRaw as {
    attestation_id: string;
    seal_id: string;
    product_id: string;
    batch_id: string | null;
    brand: string;
    jws: string;
    record_hash: string;
    published: boolean;
  } | null;

  if (existing) {
    if (
      existing.seal_id !== seal.id ||
      existing.product_id !== seal.product_id ||
      (existing.batch_id ?? null) !== (seal.batch_id ?? null) ||
      existing.record_hash !== input.recordHash ||
      existing.jws !== input.jws
    ) {
      return {
        ok: false,
        status: 409,
        error: "attestation_id already belongs to a different signed record",
      };
    }
  } else {
    const { error: insertError } = await db.from(table).insert({
      attestation_id: attestation.attestation_id,
      seal_id: seal.id,
      product_id: seal.product_id,
      batch_id: seal.batch_id,
      brand: seal.brand,
      object_id: attestation.subject.object_id,
      product_class: attestation.subject.product_class ?? null,
      gtin: attestation.subject.gtin ?? null,
      serial: attestation.subject.serial ?? null,
      lot: attestation.subject.lot ?? null,
      issuer_id: attestation.issuer.id,
      issuer_kid: input.issuerKid,
      decision: attestation.decision,
      payload: attestation,
      jws: input.jws,
      record_hash: input.recordHash,
      published: false,
      published_at: null,
    });
    if (insertError) {
      // A concurrent, identical retry may have won the unique-key race.
      const { data: racedRaw, error: racedError } = await db
        .from(table)
        .select("attestation_id,seal_id,product_id,batch_id,brand,jws,record_hash,published")
        .eq("attestation_id", attestation.attestation_id)
        .maybeSingle();
      if (racedError || !racedRaw) {
        return { ok: false, status: 503, error: "signed record write failed" };
      }
      existing = racedRaw as typeof existing;
      if (
        !existing ||
        existing.seal_id !== seal.id ||
        existing.product_id !== seal.product_id ||
        (existing.batch_id ?? null) !== (seal.batch_id ?? null) ||
        existing.record_hash !== input.recordHash ||
        existing.jws !== input.jws
      ) {
        return {
          ok: false,
          status: 409,
          error: "attestation_id already belongs to a different signed record",
        };
      }
    } else {
      existing = null;
    }
  }

  const statusEvent = await recordStatusEvent(env, {
    eventType: "attestation.issued",
    attestationId: attestation.attestation_id,
    issuerId: attestation.issuer.id,
    subjectHash: input.subjectHash,
    evidenceDigest: input.evidenceDigest,
    idempotencyKey: `publish:${attestation.attestation_id}`,
  });
  if (!statusEvent.ok) {
    return {
      ok: false,
      status: 503,
      error: "could not record durable attestation issuance status",
    };
  }

  if (existing?.published) {
    return {
      ok: true,
      eventId: statusEvent.eventId,
      alreadyPublished: true,
      seal,
    };
  }

  const { data: published, error: publishError } = await db
    .from(table)
    .update({ published: true, published_at: new Date().toISOString() })
    .eq("attestation_id", attestation.attestation_id)
    .eq("record_hash", input.recordHash)
    .select("attestation_id")
    .maybeSingle();
  if (publishError || !published) {
    // The row remains unpublished; a retry with the same JWS can finish the
    // publication without allowing an unrecorded or altered payload to leak.
    return { ok: false, status: 503, error: "signed record publication failed" };
  }

  return { ok: true, eventId: statusEvent.eventId, alreadyPublished: false, seal };
}

