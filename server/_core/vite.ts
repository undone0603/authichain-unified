import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

// Simple in-memory rate limiter for development
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 100;
const rateLimits = new Map<string, { count: number; start: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip);

  if (!limit || now - limit.start > RATE_LIMIT_WINDOW) {
    rateLimits.set(ip, { count: 1, start: now });
    return false;
  }

  limit.count++;
  return limit.count > MAX_REQUESTS;
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  // Path-less middleware (Express 5 / path-to-regexp v8 reject a bare "*" path).
  app.use(async (req, res, next) => {
    const url = req.originalUrl;
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";

    if (isRateLimited(clientIp)) {
      return res.status(429).send("Too many requests, please try again later.");
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../../",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../../", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
    return;
  }

  // Serve the built client assets (JS/CSS/images).
  app.use(express.static(distPath));

  // SPA fallback: GET requests that weren't handled by an API route above and
  // don't map to a static file return index.html so client-side routing
  // (wouter) can take over. Path-less middleware (not "*") because Express 5 /
  // path-to-regexp v8 reject a bare "*" path. /api and non-GET fall through to
  // their handlers / proper 404s.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
