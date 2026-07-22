import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import type { IMissionsRepository } from "../missions/types";
import type { IAdminRepository } from "../admin/types";
import { DbMissionsRepository } from "../missions/db-repository";
import { DbAdminRepository } from "../admin/db-repository";
import { getHyperdriveDb } from "../db";

export type TrpcContext = {
  db: ReturnType<typeof getHyperdriveDb>;
  user: User | null;
  missionsRepo?: IMissionsRepository;
  adminRepo?: IAdminRepository;
};

type WorkersEnv = { HYPERDRIVE: { connectionString: string } };

export async function createWorkersContext(
  opts: FetchCreateContextFnOptions,
  env: WorkersEnv
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  const db = getHyperdriveDb(env);

  return {
    db,
    user,
    // DbMissionsRepository accepts an optional injected db (Task 2b-3) --
    // pass the real per-request Workers db so ctx.missionsRepo doesn't fall
    // through to its legacy getDb()/process.env.DATABASE_URL bridge, which
    // isn't expected to work in the Workers runtime.
    missionsRepo: new DbMissionsRepository(db),
    // DbAdminRepository doesn't support injection yet (server/admin/** is
    // migrated in Task 2b-4, not yet done) -- update this call the same way
    // once that lands, or this will have the same gap missionsRepo just had.
    adminRepo: new DbAdminRepository(),
  };
}
