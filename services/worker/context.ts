import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { User } from "../drizzle/schema";
import { sdk } from "../server/_core/sdk";

export type PendingCookie = {
  name: string;
  value: string;
  maxAge?: number;
  clear?: boolean;
};

export type WorkerTrpcContext = {
  req: any;
  res: any;
  user: User | null;
  _pendingCookies: PendingCookie[];
};

export function createWorkerContext(request: Request): WorkerTrpcContext {
  const pendingCookies: PendingCookie[] = [];

  const req = {
    headers: {
      cookie: request.headers.get("Cookie") ?? "",
      "x-forwarded-proto": "https",
      host: new URL(request.url).hostname,
    },
    protocol: "https",
    hostname: new URL(request.url).hostname,
    ip: request.headers.get("CF-Connecting-IP") ?? undefined,
  };

  const res = {
    cookie(name: string, value: string, opts?: { maxAge?: number }) {
      pendingCookies.push({ name, value, maxAge: opts?.maxAge });
    },
    clearCookie(name: string) {
      pendingCookies.push({ name, value: "", clear: true });
    },
    _pendingCookies: pendingCookies,
  };

  return { req, res, user: null, _pendingCookies: pendingCookies };
}

export async function authenticateWorkerContext(
  ctx: WorkerTrpcContext
): Promise<WorkerTrpcContext> {
  try {
    ctx.user = await sdk.authenticateRequest(ctx.req);
  } catch {
    ctx.user = null;
  }
  return ctx;
}

export function buildSetCookieHeaders(ctx: WorkerTrpcContext): string[] {
  return ctx._pendingCookies.map((c) => {
    if (c.clear) {
      return `${c.name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`;
    }
    const maxAge = c.maxAge != null
      ? `; Max-Age=${Math.round(c.maxAge / 1000)}`
      : `; Max-Age=${Math.round(ONE_YEAR_MS / 1000)}`;
    return `${c.name}=${c.value}; Path=/; HttpOnly; SameSite=Lax${maxAge}; Secure`;
  });
}

export function sessionCookieValue(
  name: typeof COOKIE_NAME,
  token: string
): PendingCookie {
  return { name, value: token, maxAge: ONE_YEAR_MS };
}
