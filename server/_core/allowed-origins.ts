import { ENV } from "./env";

export const ALLOWED_ORIGIN_HOSTNAMES = new Set([
  "authichain.com",
  "www.authichain.com",
  "qronspace.com",
  "www.qronspace.com",
]);

function isAllowed(hostname: string): boolean {
  if (!ENV.isProduction && hostname === "localhost") return true;
  return ALLOWED_ORIGIN_HOSTNAMES.has(hostname) || hostname.endsWith(".vercel.app");
}

/** Returns a safe origin (scheme + host) from a raw user-supplied value.
 *  Falls back to https://authichain.com for anything that doesn't parse or
 *  isn't on the allowlist. */
export function safeOrigin(raw: string): string {
  try {
    const { protocol, hostname, port } = new URL(raw);
    if (isAllowed(hostname)) {
      return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
    }
  } catch {
    // fall through
  }
  return "https://authichain.com";
}

/** Returns a safe full URL from a raw user-supplied value.
 *  Falls back to the provided `fallback` URL. */
export function safeUrl(raw: string, fallback: string): string {
  try {
    const { protocol, hostname, port, pathname, search } = new URL(raw);
    if (isAllowed(hostname)) {
      const portPart = port ? `:${port}` : "";
      return `${protocol}//${hostname}${portPart}${pathname}${search}`;
    }
  } catch {
    // fall through
  }
  return fallback;
}
