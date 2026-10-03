/**
 * Pure helpers for the paid agent registry lookup
 * (src/app/api/v1/agent-verify/route.ts).
 *
 * What this path can and cannot say. The registry row in `auth_seals` is keyed
 * by UUID and has no revocation column. A row only proves the seal was
 * registered. `verified` is reserved for protocol/verifier.mjs (Ed25519 +
 * mainnet anchor) via attestSeal — this module does not set it.
 */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  return { ok: true, sealId };
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
