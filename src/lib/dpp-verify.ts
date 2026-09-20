/**
 * GET/POST /api/dpp/verify — record verification only when a published DPP exists.
 * Shared by Next and worker-app.
 */

import { recordDppLoopEventOnce } from "./dpp-loop";

export const DPP_VERIFY_CLAIMS = {
  verified: {
    proves: "This passport is published and resolves to a registered product record.",
    doesNotProve:
      "Does not prove the physical item in hand matches it, nor the accuracy of the data the merchant supplied.",
  },
  not_found: {
    proves: "Nothing. No published passport exists for this identifier.",
    doesNotProve:
      "Absence here is not proof of counterfeit — the product may simply never have been published.",
  },
} as const;

export type DppVerifyOk = {
  ok: true;
  status: "verified";
  dpp_id: string;
  product: { name: string | null; brand: string | null };
  proves: string;
  doesNotProve: string;
  event_recorded: boolean;
};

export type DppVerifyErr = {
  ok: false;
  status: 400 | 404 | 500;
  error: string;
  dpp_id?: string;
  proves?: string;
  doesNotProve?: string;
  event_recorded?: boolean;
  detail?: string;
};

type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export async function verifyDpp(opts: {
  dppId: string;
  visitId: string | null;
  source: string;
  supabase: SupabaseLike | null;
}): Promise<DppVerifyOk | DppVerifyErr> {
  const dppId = opts.dppId.trim();
  if (!dppId) {
    return { ok: false, status: 400, error: "dpp_id required" };
  }
  if (!opts.supabase) {
    return { ok: false, status: 500, error: "Database not configured" };
  }

  const { data: product } = await opts.supabase
    .from("products")
    .select("id, name, brand, status, metadata")
    .eq("id", dppId)
    .maybeSingle();

  const isPublished =
    !!product &&
    product.status === "published" &&
    !!(product.metadata as { dpp?: boolean } | undefined)?.dpp;

  if (!isPublished) {
    return {
      ok: false,
      status: 404,
      error: "not_found",
      dpp_id: dppId,
      ...DPP_VERIFY_CLAIMS.not_found,
      event_recorded: false,
    };
  }

  let recorded = false;
  const visitId = opts.visitId?.trim() || null;
  if (visitId) {
    const result = await recordDppLoopEventOnce(opts.supabase, {
      visitId,
      stage: "verification",
      source: opts.source || "direct",
      dedupeKey: `verify:${dppId}`,
      metadata: {
        dpp_id: dppId,
        product_name: product.name,
        verified_at: new Date().toISOString(),
      },
    });
    recorded = result.recorded;
  }

  return {
    ok: true,
    status: "verified",
    dpp_id: dppId,
    product: { name: product.name, brand: product.brand },
    ...DPP_VERIFY_CLAIMS.verified,
    event_recorded: recorded,
  };
}
