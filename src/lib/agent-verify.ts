/**
 * Pure helpers for the paid agent registry lookup
 * (src/app/api/v1/agent-verify/route.ts).
 *
 * What this path can and cannot say. The registry row in `auth_seals` is keyed
 * by UUID and has no revocation column. A row only proves the seal was
 * registered. `verified` is reserved for protocol/verifier.mjs (Ed25519 +
 * mainnet anchor) via attestSeal — this module does not set it.
 */

import { isDiscoveryExampleSealId } from "./x402";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Bazaar discovery example. It matches the UUID shape and is not a registry row. */
const NIL_SEAL_ID = "00000000-0000-4000-8000-000000000000";

export type SealRequest =
  | { ok: true; sealId: string }
  | {
      ok: false;
      status: 400;
      body: { error: string; detail: string; settled: false };
    };

export function parseSealRequest(input: Record<string, unknown>): SealRequest {
  const raw = input.sealId ?? input.seal_id;
  const sealId = typeof raw === "string" ? raw.trim() : "";
  if (!sealId) {
    const aliasOnly = input.productId !== undefined || input.serial !== undefined;
    return {
      ok: false,
      status: 400,
      body: {
        error: "seal_id_required",
        detail: aliasOnly
          ? "productId and serial are not registry keys on this path. Send sealId (a seal UUID). No payment was taken."
          : "Send sealId (a seal UUID). No payment was taken.",
        settled: false,
      },
    };
  }
  if (!UUID.test(sealId)) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "seal_id_not_uuid",
        detail:
          "Seal ids are UUIDs; this value cannot exist in the registry. No payment was taken.",
        settled: false,
      },
    };
  }
  if (sealId.toLowerCase() === NIL_SEAL_ID) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "seal_id_nil",
        detail:
          "The all-zero UUID is the discovery example, not a registry seal. No payment was taken.",
        settled: false,
      },
    };
  }
  return { ok: true, sealId };
}

/**
 * Unpaid calls with a body that cannot be a registry key are 400.
 * An empty object stays null so the caller can still return the 402
 * price challenge. A real seal UUID also stays null. The all-zero
 * discovery example is 400.
 */
export function unpaidSealRefusal(
  raw: Record<string, unknown>
): { status: number; body: Extract<SealRequest, { ok: false }>["body"] } | null {
  const body = coerceSealBody(raw);
  const listed = listedSealId(body);
  if (!listed) return null;
  if (isDiscoveryExampleSealId(listed)) return null;
  const parsed = parseSealRequest(body);
  if (parsed.ok) return null;
  return { status: parsed.status, body: parsed.body };
}

export type RegistryAnswer = {
  registered: boolean;
  status: "registered" | "not_registered";
  checks: {
    registry: "found" | "not_found";
    signature: "not_checked" | "checked";
    revocation: "not_available";
  };
  details: Record<string, unknown>;
};

export function registryAnswer(
  seal: Record<string, unknown> | null | undefined
): RegistryAnswer {
  const registered = !!seal;
  return {
    registered,
    status: registered ? "registered" : "not_registered",
    checks: {
      registry: registered ? "found" : "not_found",
      signature: "not_checked",
      revocation: "not_available",
    },
    details: seal
      ? {
          productId: seal.product_id,
          batchId: seal.batch_id,
          brand: seal.brand,
          createdAt: seal.created_at,
        }
      : {},
  };
}
