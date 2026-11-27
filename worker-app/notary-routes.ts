/** POST /api/notary: Lightning-paid notary stamp (src/lib/l402-notary.ts). Served on app.authichain.com. */
import type { Hono } from "hono";
import { handleNotary, type NotaryEnv } from "../src/lib/l402-notary";

export function registerNotaryRoutes<
  E extends NotaryEnv,
  V extends Record<string, unknown> = Record<string, never>,
>(app: Hono<{ Bindings: E; Variables: V }>): void {
  app.post("/api/notary", c => handleNotary(c.req.raw, c.env));
}
