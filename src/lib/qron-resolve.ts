/**
 * Living QR scan target. The QR encodes this URL. A scan loads the stored
 * attestation and returns AuthiChain Verification Decision v1.
 */
import { toString as qrToString } from "qrcode";
import {
  CANONICAL_VERIFY_URL,
  DECISION_CONTRACT,
  qronObjectIdForDestination,
} from "./qron-presentation";

export const QRON_RESOLVE_ORIGIN = "https://authichain.com";
export const QRON_KV_PREFIX = "qron:presentation:";

export type StoredQronPresentation = {
  object_id: string;
  destination_url: string;
  resolve_url: string;
  jws: string;
  kid: string;
  jwks_url: string;
};

export function qronResolvePath(objectId: string): string {
  return `/qron/r/${encodeURIComponent(objectId)}`;
}

export function qronResolveUrl(
  objectId: string,
  origin: string = QRON_RESOLVE_ORIGIN
): string {
  return `${origin.replace(/\/$/, "")}${qronResolvePath(objectId)}`;
}

export function qronPresentationKvKey(objectId: string): string {
  return `${QRON_KV_PREFIX}${objectId}`;
}

export function objectIdFromResolvePath(pathname: string): string | null {
  const prefix = "/qron/r/";
  if (!pathname.startsWith(prefix)) return null;
  const raw = pathname.slice(prefix.length).replace(/\/$/, "");
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export async function scannableQrDataUrl(text: string): Promise<string> {
  const svg = await qrToString(text, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
  });
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

function wantsJson(request: Request): boolean {
  const accept = request.headers.get("accept") || "";
  return accept.includes("application/json") && !accept.includes("text/html");
}

function indeterminate(reason: string): Record<string, unknown> {
  return {
    valid: false,
    decision: "indeterminate",
    decision_contract: DECISION_CONTRACT,
    error: reason,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlDecision(body: Record<string, unknown>, destination?: string): string {
  const decision = escapeHtml(String(body.decision || "indeterminate"));
  const contract = escapeHtml(String(body.decision_contract || DECISION_CONTRACT));
  const dest =
    destination && /^https?:\/\//i.test(destination)
      ? `<p><a href="${escapeHtml(destination)}">Open destination</a></p>`
      : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${decision}</title></head><body><h1>${decision}</h1><p>${contract}</p>${dest}</body></html>`;
}

export async function handleQronResolve(
  request: Request,
  deps: {
    load: (objectId: string) => Promise<StoredQronPresentation | null>;
    verify?: (jws: string, objectId: string) => Promise<{ status: number; body: Record<string, unknown> }>;
    fetchImpl?: typeof fetch;
    verifyUrl?: string;
  }
): Promise<Response | null> {
  const url = new URL(request.url);
  const objectId = objectIdFromResolvePath(url.pathname);
  if (!objectId) return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(JSON.stringify(indeterminate("method_not_allowed")), {
      status: 405,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const stored = await deps.load(objectId);
  let status = 404;
  let body = indeterminate("presentation_not_found");
  if (stored?.jws) {
    if (deps.verify) {
      const verified = await deps.verify(stored.jws, objectId);
      status = verified.status;
      body = verified.body;
    } else {
      const endpoint = deps.verifyUrl || CANONICAL_VERIFY_URL;
      const fetchImpl = deps.fetchImpl || fetch;
      try {
        const res = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            jws: stored.jws,
            expected_object_id: objectId,
          }),
        });
        const parsed = await res.json().catch(() => null);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          status = 502;
          body = indeterminate("verify_unreachable");
        } else {
          status = res.status;
          body = parsed as Record<string, unknown>;
        }
      } catch {
        status = 502;
        body = indeterminate("verify_unreachable");
      }
    }
  }

  const headers = { "cache-control": "no-store" };
  if (request.method === "HEAD") {
    return new Response(null, {
      status,
      headers: { ...headers, "content-type": wantsJson(request) ? "application/json" : "text/html; charset=utf-8" },
    });
  }
  if (wantsJson(request)) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...headers, "content-type": "application/json" },
    });
  }
  return new Response(htmlDecision(body, stored?.destination_url), {
    status,
    headers: { ...headers, "content-type": "text/html; charset=utf-8" },
  });
}

export function resolveTargetForDestination(destinationUrl: string): {
  objectId: string;
  resolveUrl: string;
} {
  const objectId = qronObjectIdForDestination(destinationUrl);
  return { objectId, resolveUrl: qronResolveUrl(objectId) };
}
