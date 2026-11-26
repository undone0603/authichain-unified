// Durable Object that makes "one Lightning payment, one call" atomic.
//
// One instance per payment hash (idFromName("l402:ph:<hash>")). Every
// operation runs inside blockConcurrencyWhile, so no other request for the
// same payment hash is delivered until the read-and-write finishes: ten
// simultaneous redemptions of one token produce exactly one "claimed".
// KV could not give that guarantee (separate read and write), and unlike
// x402 there is no on-chain settlement afterwards to reject a duplicate.
//
// fetch()-based like rate-limiter.ts, so this file stays importable under the
// plain Node vitest environment (no "cloudflare:workers" base class).

/** Claims outlive any token (1 h max) by a wide margin, then clean themselves up. */
export const L402_CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type L402ClaimOp = "claim" | "release" | "settle";
export type L402ClaimOpResult = "claimed" | "replay" | "released" | "settled" | "bad_op";

type ClaimState = Pick<DurableObjectState, "blockConcurrencyWhile"> & {
  storage: Pick<DurableObjectStorage, "get" | "put" | "delete" | "deleteAll" | "setAlarm">;
};

export class L402Claims {
  private readonly state: ClaimState;

  constructor(state: ClaimState, _env: unknown) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    let op: unknown;
    try {
      op = ((await request.json()) as { op?: unknown })?.op;
    } catch {
      op = undefined;
    }
    const result = await this.apply(op);
    return new Response(JSON.stringify({ result }), {
      status: result === "bad_op" ? 400 : 200,
      headers: { "content-type": "application/json" },
    });
  }

  /** The whole read-modify-write is one critical section per payment hash. */
  apply(op: unknown): Promise<L402ClaimOpResult> {
    return this.state.blockConcurrencyWhile(async () => {
      const storage = this.state.storage;
      const current = await storage.get<string>("state");
      if (op === "claim") {
        if (current) return "replay";
        await storage.put("state", "pending");
        await storage.setAlarm(Date.now() + L402_CLAIM_TTL_MS);
        return "claimed";
      }
      if (op === "release") {
        // Only an unfinished claim can be released; a served call stays spent.
        if (current === "pending") await storage.delete("state");
        return "released";
      }
      if (op === "settle") {
        await storage.put("state", "settled");
        return "settled";
      }
      return "bad_op";
    });
  }

  async alarm(): Promise<void> {
    await this.state.storage.deleteAll();
  }
}
