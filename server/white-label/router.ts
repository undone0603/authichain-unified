import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { z } from "zod";

export const whiteLabelRouter = router({
  list: adminProcedure.query(async () => {
    return await db.getWhiteLabelClients();
  }),
  create: adminProcedure.input(z.object({
    companyName: z.string().min(1),
    domain: z.string().optional(),
    logoUrl: z.string().optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    apiCallLimit: z.number().optional().default(10000),
  })).mutation(async ({ ctx, input }) => {
    const crypto = await import("crypto");
    const apiKey = `wl_${crypto.randomBytes(24).toString("hex")}`;
    const apiSecret = crypto.randomBytes(32).toString("hex");
    return await db.createWhiteLabelClient({ ...input, userId: ctx.user.id, apiKey, apiSecret });
  }),
  validateApiKey: publicProcedure.input(z.object({ apiKey: z.string() })).query(async ({ input }) => {
    const client = await db.getWhiteLabelByApiKey(input.apiKey);
    return { valid: !!client && client.status === "active", client: client ? { companyName: client.companyName, domain: client.domain } : null };
  }),
});
