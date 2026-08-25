import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { isSecureRequest } from "./cookies";
import type { User } from "../../drizzle/schema";
import type { getHyperdriveDb } from "../db";
import { sdk } from "./sdk";
import type { IMissionsRepository } from "../missions/types";
import type { IAdminRepository } from "../admin/types";
import { DbMissionsRepository } from "../missions/db-repository";
import { DbAdminRepository } from "../admin/db-repository";

// Single canonical tRPC context for BOTH runtimes. Runtime-specific fields
// (req/res on Express, db on Workers) are optional; shared fields are
// required. appRouter binds to this type via trpc.ts, so both createContext
// (Express) and createWorkersContext (Workers) must return a value assignable
// to it.
export type TrpcContext = {
  req?: CreateExpressContextOptions["req"];
  res?: CreateExpressContextOptions["res"];
  db?: ReturnType<typeof getHyperdriveDb>;
  user: User | null;
  secure: boolean;
  setCookieHeader: (value: string) => void;
  missionsRepo?: IMissionsRepository;
  adminRepo?: IAdminRepository;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    secure: isSecureRequest(opts.req),
    setCookieHeader: (value: string) => { opts.res.append("Set-Cookie", value); },
    missionsRepo: new DbMissionsRepository(),
    adminRepo: new DbAdminRepository(),
  };
}
