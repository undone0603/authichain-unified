import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { resolveBrand } from "../../shared/brands";

function injectBrandMetadata(template: string, brand: string): string {
  return template.replace(
    "<head>",
    `<head>\n    <meta name="x-brand" content="${brand}" />`
  );
}

function brandInjectionScript(brand: string): string {
  return `<script>window.__BRAND__ = ${JSON.stringify(brand)};</script>`;
}

// Simple in-memory rate limiter for development and production
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
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";

    if (isRateLimited(clientIp)) {
      return res.status(429).send("Too many requests, please try again later.");
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      // Inject brand-detection snippet and metadata before the main script
      const brand = resolveBrand(
        (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host
      );
      template = injectBrandMetadata(template, brand);
      template = template.replace(
        '<div id="root"></div>',
        `<div id="root"></div>\n        ${brandInjectionScript(brand)}`
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
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  let cachedTemplate: string | null = null;
  const indexPath = path.resolve(distPath, "index.html");

  app.use("*", (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    if (isRateLimited(clientIp)) {
      return res.status(429).send("Too many requests, please try again later.");
    }
    try {
      if (cachedTemplate === null) {
        cachedTemplate = fs.readFileSync(indexPath, "utf-8");
      }
      const brand = resolveBrand(
        (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host
      );
      let html = injectBrandMetadata(cachedTemplate, brand);
      html = html.replace(
        '<div id="root"></div>',
        `<div id="root"></div>\n        ${brandInjectionScript(brand)}`
      );
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch {
      // Fallback: if injection fails for any reason, just serve the file
      res.sendFile(indexPath);
    }
  });
}
