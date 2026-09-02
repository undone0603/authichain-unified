  import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
  import type { User } from "../../drizzle/schema";
  import { DbAdminRepository } from "../admin/db-repository";
  import type { IAdminRepository } from "../admin/types";
  import { DbMissionsRepository } from "../missions/db-repository";
  import type { IMissionsRepository } from "../missions/types";
  import { sdk } from "./sdk";

export type TrpcContext = {
  req?: CreateExpressContextOptions["req"];
  res?: CreateExpressContextOptions["res"];
  user: User | null;
  db?: unknown;
  secure?: boolean;
  setCookieHeader?: (value: string) => void;
  missionsRepo?: IMissionsRepository;
  adminRepo?: IAdminRepository;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (_unused_error_27) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    missionsRepo: new DbMissionsRepository(),
    adminRepo: new DbAdminRepository(),
  };
}
