/**
 * #2482: crash-safe DPP activation dispatch through service-role PostgREST RPCs.
 *
 * No provider call is made until a durable 'sending' marker commits. Once a
 * provider call might have started, only manual outcome reconciliation can
 * release the hold. This deliberately favors no duplicate mail over automatic
 * resend when the provider outcome is unknown. Outbox rows contain no PII.
 */
export type ActivationDispatchStatus = "sent" | "failed" | "skipped" | "held";
export type ActivationSendResult = {
  ok: boolean;
  provider?: string;
  status?: number;
  error?: string;
};
export type ActivationDispatchResult = {
  status: ActivationDispatchStatus;
  provider?: string;
  httpStatus?: number | null;
  error?: string;
};
type RpcReply = { data: unknown; error: { message?: string; code?: string } | null };
export type ActivationRpcClient = {
  rpc?: (name: string, args: Record<string, unknown>) => PromiseLike<RpcReply>;
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("dpp_activation_invalid_rpc_response");
  }
  return value as Record<string, unknown>;
}
async function call(
  db: ActivationRpcClient,
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (typeof db.rpc !== "function") throw new Error("dpp_activation_rpc_unavailable");
  const { data, error } = await db.rpc(name, args);
  if (error) {
    // Errors reaching logs must not leak remote error text or customer PII.
    throw new Error(`dpp_activation_${name}_failed:${error.code || "rpc"}`);
  }
  return object(data);
}
export async function deliverDppActivationOnce(
  db: ActivationRpcClient,
  input: { sessionId: string; profileId: string; demo: boolean },
  send: () => Promise<ActivationSendResult>
): Promise<ActivationDispatchResult> {
  if (input.demo) return { status: "skipped" };
  if (!input.sessionId || !input.profileId) {
    throw new Error("dpp_activation_missing_grant_identity");
  }
  const keys = { p_session_id: input.sessionId, p_profile_id: input.profileId };
  const initialized = await call(db, "dpp_activation_enqueue", {
    ...keys,
    p_is_demo: false,
  });
  if (initialized.status === "accepted") return { status: "skipped" };
  if (!["pending", "leased", "sending", "needs_reconciliation"].includes(String(initialized.status))) {
    throw new Error("dpp_activation_unknown_outbox_state");
  }
  const claim = await call(db, "dpp_activation_claim", keys);
  if (claim.status === "accepted") return { status: "skipped" };
  if (claim.status === "busy" || claim.status === "held") return { status: "held" };
  if (claim.status !== "claimed" || typeof claim.claim_token !== "string") {
    throw new Error("dpp_activation_invalid_claim");
  }
  const token = claim.claim_token;
  const armed = await call(db, "dpp_activation_begin_send", {
    p_session_id: input.sessionId,
    p_claim_token: token,
  });
  if (armed.status !== "armed") throw new Error("dpp_activation_not_armed");
  // NEVER retry automatically after this point: a timeout may mean Resend
  // accepted the request. dpp_activation_claim will hold on all replays.
  let result: ActivationSendResult;
  try {
    result = await send();
  } catch (err) {
    result = {
      ok: false,
      provider: "unknown",
      error: err instanceof Error ? err.message : String(err),
    };
  }
  const completed = await call(db, "dpp_activation_finish_send", {
    p_session_id: input.sessionId,
    p_claim_token: token,
    p_accepted: result.ok === true,
    p_provider: result.provider || null,
    p_http_status: result.status ?? null,
  });
  const expected = result.ok ? "accepted" : "needs_reconciliation";
  if (completed.status !== expected) throw new Error("dpp_activation_receipt_mismatch");
  return {
    status: result.ok ? "sent" : "failed",
    provider: result.provider,
    httpStatus: result.status ?? null,
    ...(!result.ok ? { error: result.error } : {}),
  };
}
