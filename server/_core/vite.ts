import express, { type Express, type Request } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

/**
 * Resolve the correct index.html based on the Host header.
 * Falls back to the default client/index.html if no domain match.
 */
function getDomainHtml(host: string): string {
  if (host.includes("qron.space")) return "qron";
  if (host.includes("strainchain.io")) return "strainchain";
  if (host.includes("govchain.us")) return "govchain";
  return "authichain";
}

function getDomainTemplatePath(req: Request, baseDir: string): string {
  const host = req.get("host") || "";
  const domain = getDomainHtml(host);
  const domainPath = path.resolve(baseDir, "client", "public", "domains", `${domain}.html`);
  if (fs.existsSync(domainPath)) return domainPath;
  return path.resolve(baseDir, "client", "index.html");
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

    try {
      const baseDir = path.resolve(import.meta.dirname, "../..");
      const templatePath = getDomainTemplatePath(req, baseDir);

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(templatePath, "utf-8");
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
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to domain-specific index.html if the file doesn't exist
  app.use("*", (req, res) => {
    const host = req.get("host") || "";
    const domain = getDomainHtml(host);
    const domainFile = path.resolve(distPath, "domains", `${domain}.html`);

    if (fs.existsSync(domainFile)) {
      res.sendFile(domainFile);
    } else {
      res.sendFile(path.resolve(distPath, "index.html"));
    }
  });
}
