import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { resolveBrand } from "../../shared/brands";
import { brandInjectionScript } from "./brand-middleware";

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

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      // Inject brand-detection snippet before the main script so
      // window.__BRAND__ is set before React mounts.
      const brand = resolveBrand(
        (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host
      );
      template = template.replace(
        '<div id="root"></div>',
        `<div id="root"></div>\n    ${brandInjectionScript(brand)}`
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

  // Cache the index.html template once; inject brand per-request.
  let cachedTemplate: string | null = null;
  const indexPath = path.resolve(distPath, "index.html");

  app.use("*", (req, res) => {
    try {
      if (cachedTemplate === null) {
        cachedTemplate = fs.readFileSync(indexPath, "utf-8");
      }
      const brand = resolveBrand(
        (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host
      );
      const html = cachedTemplate.replace(
        '<div id="root"></div>',
        `<div id="root"></div>\n    ${brandInjectionScript(brand)}`
      );
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch {
      // Fallback: if injection fails for any reason, just serve the file
      res.sendFile(indexPath);
    }
  });
}
