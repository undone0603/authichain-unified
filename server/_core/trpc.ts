import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { checkTrpcPublicLimit } from "./rate-limit";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const rateLimitMiddleware = t.middleware(({ ctx, next }) => {
  // ctx.req is present only on the Express runtime. On Workers it is
  // undefined; per-request rate limiting for the Workers path is handled
  // separately in Task 7 (Durable Object). Guard so this shared middleware
  // type-checks against the unified context and no-ops cleanly on Workers
  // until then.
  if (ctx.req) checkTrpcPublicLimit(ctx.req);
  return next();
});

/** publicProcedure with per-IP rate limiting — use for all unauthenticated mutations */
export const rateLimitedPublicProcedure = t.procedure.use(rateLimitMiddleware);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
