import { COOKIE_NAME } from "@shared/const";
import { publicProcedure, router } from "../_core/trpc";

export const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    // Clear the session cookie. Works in both the Express adapter (ctx.res
    // present) and the Workers/Fetch adapter (ctx.setCookieHeader present).
    const clearValue = [
      `${COOKIE_NAME}=`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=0",
      ...(ctx.secure ? ["Secure"] : []),
    ].join("; ");

    if (ctx.setCookieHeader) {
      ctx.setCookieHeader(clearValue);
    } else if (ctx.res) {
      ctx.res.setHeader("Set-Cookie", clearValue);
    }

    return { success: true } as const;
  }),
});
