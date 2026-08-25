import { buildClearSessionCookieHeader } from "../_core/cookies";
import { publicProcedure, router } from "../_core/trpc";

export const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.setCookieHeader(buildClearSessionCookieHeader(ctx.secure));
    return { success: true } as const;
  }),
});
