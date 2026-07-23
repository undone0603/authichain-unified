import type { CookieOptions, Request } from "express";
import { COOKIE_NAME } from "@shared/const";

export function isSecureRequest(req: Request): boolean {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");
  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

// Runtime-agnostic: takes a plain `secure` boolean instead of an Express
// Request, so both the Express and Workers tRPC contexts can call it.
export function getSessionCookieOptions(
  secure: boolean
): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure"> {
  return {
    httpOnly: true,
    path: "/",
    // "lax" blocks cross-site POSTs (CSRF protection) while still allowing
    // navigation-driven GET flows (OAuth redirects, email link clicks).
    sameSite: "lax",
    secure,
  };
}

// Builds a Set-Cookie header string that deletes the session cookie.
// Attributes (Path/SameSite/Secure) match what the login side sets via
// getSessionCookieOptions so the browser reliably matches and deletes it.
// Runtime-agnostic — works for both Express (res.append) and Workers
// (resHeaders.append).
export function buildClearSessionCookieHeader(secure: boolean): string {
  const parts = [`${COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
