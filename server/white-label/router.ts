import { randomBytes } from "crypto";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { getWhiteLabelClients, createWhiteLabelClient, getWhiteLabelByApiKey } from "../identity-db-helpers";
import { z } from "zod";
import { generateApiKey } from "../tenant-billing";

export const whiteLabelRouter = router({
  list: adminProcedure.query(async () => {
    // TrpcContext (server/_core/context.ts) has no `db` -- only the Workers
    // context does. Bridge via getDb() until this router has a ctx.db to use.
    const db = await getDb();
    return await getWhiteLabelClients(db);
  }),
  create: adminProcedure.input(z.object({
    companyName: z.string().min(1),
    domain: z.string().optional(),
    logoUrl: z.string().optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    apiCallLimit: z.number().optional().default(10000),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb(); // see list() above
    const apiKey = generateApiKey("wl");
    const apiSecret = randomBytes(32).toString("hex");
    return await createWhiteLabelClient(db, { ...input, userId: ctx.user.id, apiKey, apiSecret });
  }),
  validateApiKey: publicProcedure.input(z.object({ apiKey: z.string() })).query(async ({ input }) => {
    const db = await getDb(); // see list() above
    const client = await getWhiteLabelByApiKey(db, input.apiKey);
    return { valid: !!client && client.status === "active", client: client ? { companyName: client.companyName, domain: client.domain } : null };
  }),
});
