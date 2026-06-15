import "dotenv/config";
import { createServer } from "http";
import net from "net";
import { createApp } from "./app";
import { serveStatic, setupVite } from "./vite";
import { initializeScheduler } from "../scheduled-jobs";
import { ENV } from "./env";

function validateEnv(): void {
  if (!ENV.isProduction) return;
  const checks: [string, string | undefined][] = [
    ["JWT_SECRET",             process.env.JWT_SECRET],
    ["DATABASE_URL",           process.env.DATABASE_URL],
    ["INTERNAL_API_SECRET",    process.env.INTERNAL_API_SECRET],
    ["STRIPE_WEBHOOK_SECRET",  process.env.STRIPE_WEBHOOK_SECRET],
    ["CRON_SECRET",            process.env.CRON_SECRET],
  ];
  const missing = checks.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`[Startup] Missing required production env vars: ${missing.join(", ")}`);
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  validateEnv();
  const app = createApp();
  const server = createServer(app);

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}/`);
    try {
      await initializeScheduler();
    } catch (err) {
      console.error("Failed to initialize scheduler:", err);
    }
  });
}

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  process.exit(1);
});

startServer().catch(console.error);
