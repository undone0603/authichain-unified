  import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
  import type { User } from "../../drizzle/schema";
  import { DbAdminRepository } from "../admin/db-repository";
  import { getHyperdriveDb } from "../db";
  import { DbMissionsRepository } from "../missions/db-repository";
  import type { TrpcContext } from "./context";
  import { sdk } from "./sdk";

type WorkersEnv = { HYPERDRIVE: { connectionString: string } };

export async function createWorkersContext(
  opts: FetchCreateContextFnOptions,
  env: WorkersEnv
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req as unknown as import("express").Request);
  } catch (_unused_error_19) {
    // Authentication is optional for public procedures.
    user = null;
  }

  const db = getHyperdriveDb(env);

  const url = new URL(opts.req.url);
  const forwardedProto = opts.req.headers.get("x-forwarded-proto");
  const secure =
    url.protocol === "https:" ||
    (forwardedProto?.split(",").some(p => p.trim().toLowerCase() === "https") ?? false);

  return {
    db,
    user,
    secure,
    setCookieHeader: (value: string) => { opts.resHeaders.append("Set-Cookie", value); },
    // DbMissionsRepository accepts an optional injected db (Task 2b-3) --
    // pass the real per-request Workers db so ctx.missionsRepo doesn't fall
    // through to its legacy getDb()/process.env.DATABASE_URL bridge, which
    // isn't expected to work in the Workers runtime.
    missionsRepo: new DbMissionsRepository(),
    adminRepo: new DbAdminRepository(),
  };
}
