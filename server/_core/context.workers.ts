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

  return {
    db: getHyperdriveDb(env),
    user,
    missionsRepo: new DbMissionsRepository(),
    adminRepo: new DbAdminRepository(),
  };
}
