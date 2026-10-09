import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { checkTrpcPublicLimit } from "./rate-limit";

// Stack traces and raw internal error messages are returned only when the
// process explicitly runs in development. tRPC's own default treats anything
// other than NODE_ENV=production as dev, and the Workers bundle does not set
// NODE_ENV, so production was returning stacks. This fails closed instead.
export const TRPC_GENERIC_INTERNAL_MESSAGE = "Internal server error";

export function isTrpcDevRuntime(): boolean {
  return typeof process !== "undefined" && process.env?.NODE_ENV === "development";
}

export const trpcErrorFormatter = ({
  shape,
  error,
}: {
  shape: { message: string; code: number; data: Record<string, unknown> & { stack?: string } };
  error: { code: string };
}) => {
  if (isTrpcDevRuntime()) return shape;
  const { stack: _stack, ...data } = shape.data;
  return {
    ...shape,
    message: error.code === "INTERNAL_SERVER_ERROR" ? TRPC_GENERIC_INTERNAL_MESSAGE : shape.message,
    data,
  };
};

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  isDev: isTrpcDevRuntime(),
  errorFormatter: trpcErrorFormatter,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const rateLimitMiddleware = t.middleware(({ ctx, next }) => {
  checkTrpcPublicLimit(ctx.req!);
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
