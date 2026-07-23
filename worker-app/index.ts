import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "../server/routers";
import { createWorkersContext } from "../server/_core/context.workers";
import { resolveBrand, type BrandId } from "../shared/brands";

type Env = {
  HYPERDRIVE: Hyperdrive;
  ASSETS: Fetcher;
  SESSIONS: KVNamespace;
};

type Variables = {
  brand: BrandId;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Brand resolution — same logic as src/middleware.ts and the old
// server/_core/brand-middleware.ts, ported to Hono context instead of
// Express res.locals.
app.use("*", async (c, next) => {
  const host = c.req.header("x-forwarded-host") ?? c.req.header("host") ?? "";
  const brand = resolveBrand(host);
  c.set("brand", brand);
  c.header("X-Brand", brand);
  await next();
});

app.use(
  "/api/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (opts, c) => createWorkersContext(opts, c.env),
  })
);

app.get("/api/health", (c) => c.json({ status: "ok" }));

// Static assets fallback (Vite build output, same dist/public the existing
// worker/index.ts already serves for the marketing page).
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
