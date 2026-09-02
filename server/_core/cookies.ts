// Single source of truth lives in shared/const.ts — re-exported here so
// existing imports from this module keep working.
  export { COOKIE_NAME } from "@shared/const";

  import type { CookieOptions,Request } from "express";

const _unused_LOCAL_HOSTS_7 = new Set(["localhost", "127.0.0.1", "::1"]);

function _unused_isIpAddress_9(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // const hostname = req.hostname;
  // const shouldSetDomain =
  //   hostname &&
  //   !LOCAL_HOSTS.has(hostname) &&
  //   !isIpAddress(hostname) &&
  //   hostname !== "127.0.0.1" &&
  //   hostname !== "::1";

  // const domain =
  //   shouldSetDomain && !hostname.startsWith(".")
  //     ? `.${hostname}`
  //     : shouldSetDomain
  //       ? hostname
  //       : undefined;

  return {
    httpOnly: true,
    path: "/",
    // "lax" blocks cross-site POSTs (CSRF protection) while still allowing
    // navigation-driven GET flows (OAuth redirects, email link clicks).
    // Use "none" only if third-party iframe embedding is required.
    sameSite: "lax",
    secure: isSecureRequest(req),
  };
}
