/**
 * GET /seal/{id} — public, read-only seal check on authichain.com.
 *
 * StrainChain owns GET /passport (index) and 302s GET /passport/{id} onto
 * that index. This page is the consumer surface the resolver's
 * /v1/passport/{id} read was meant to feed, without recording a scan.
 *
 * Honesty:
 *   - Fetch only https://id.authichain.com/v1/passport/{id}. Never /cert/{id}
 *     or any other scan path (those bump clone counters).
 *   - Resolver proves / doesNotProve copy is rendered verbatim.
 *   - No JWS on the payload is shown as "unsigned".
 *   - Unknown ids show the resolver's not_found copy. No checkout, no $49
 *     StrainChain redirect, no $29 Starter Pack.
 *   - Product seals are in development. This page does not prove a physical
 *     object is genuine.
 */

export const SEAL_VERIFY_PREFIX = "/seal/";
export const RESOLVER_PASSPORT_BASE = "https://id.authichain.com/v1/passport";
export const FETCH_TIMEOUT_MS = 4000;

const COULD_NOT_VERIFY = "could not verify right now";

/** Reasonable GS1 / demo / UUID charset. Anything else is rejected unfetched. */
const SEAL_ID_RE = /^[A-Za-z0-9._-]{1,128}$/;

const WARNING_STATUSES = new Set(["clone_suspected", "cloned", "revoked"]);

const STATUS_LABEL: Record<string, string> = {
  issued: "Issued — not yet activated",
  active: "Authentic",
  clone_suspected: "Clone suspected",
  cloned: "Cloned or diverted",
  revoked: "Revoked",
  not_found: "Not found",
};

const STATUS_TONE: Record<string, string> = {
  issued: "#8a6d00",
  active: "#0f7b3f",
  clone_suspected: "#b25e00",
  cloned: "#a5122a",
  revoked: "#a5122a",
  not_found: "#5a5a5a",
};

const HTML_SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data: https:; frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

export type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

type SealStatus =
  "issued" | "active" | "clone_suspected" | "cloned" | "revoked" | "not_found";

interface ResolverPassport {
  status: SealStatus | string;
  label?: string;
  proves?: string;
  doesNotProve?: string;
  jws?: unknown;
  proof?: unknown;
  metadata?: unknown;
  identifier?: {
    serial?: string | null;
    certId?: string | null;
  } | null;
  product?: {
    brand?: string | null;
    name?: string | null;
  } | null;
}

export function isValidSealId(id: string): boolean {
  if (id === "." || id === "..") return false;
  return SEAL_ID_RE.test(id);
}

export function isWarningStatus(status: string): boolean {
  return WARNING_STATUSES.has(status);
}

/** Resolver label for the status. Warning states never surface "Authentic". */
export function displayLabel(status: string, payloadLabel?: string): string {
  if (isWarningStatus(status)) {
    return STATUS_LABEL[status] ?? status;
  }
  const raw = (payloadLabel ?? STATUS_LABEL[status] ?? status).trim();
  return raw || status;
}

/**
 * Returns the path id when this worker owns GET /seal/{id}.
 * Empty / extra segments are not this page (caller 404s).
 * A matching path with a bad charset is "invalid" so we fail closed
 * without talking to the resolver.
 */
export function matchSealVerifyPath(
  pathname: string
): { ok: true; id: string } | { ok: false; reason: "invalid" } | null {
  if (!pathname.startsWith(SEAL_VERIFY_PREFIX)) return null;
  let rest = pathname.slice(SEAL_VERIFY_PREFIX.length);
  while (rest.endsWith("/")) rest = rest.slice(0, -1);
  if (!rest || rest.includes("/")) return null;
  let id: string;
  try {
    id = decodeURIComponent(rest);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!isValidSealId(id)) return { ok: false, reason: "invalid" };
  return { ok: true, id };
}

export function resolverPassportUrl(id: string): string {
  return `${RESOLVER_PASSPORT_BASE}/${encodeURIComponent(id)}`;
}

function esc(value: string): string {
  return value.replace(
    /[&<>"']/g,
    c =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** True only when the resolver actually attached a JWS string. */
export function payloadHasJws(payload: unknown): boolean {
  const root = asRecord(payload);
  if (!root) return false;
  if (typeof root.jws === "string" && root.jws.trim()) return true;
  const nested = [asRecord(root.metadata), asRecord(root.proof)];
  for (const obj of nested) {
    if (obj && typeof obj.jws === "string" && obj.jws.trim()) return true;
  }
  return false;
}

function issuanceStatus(status: string): string {
  if (status === "issued" || status === "revoked" || status === "not_found") {
    return status;
  }
  // active / clone_suspected / cloned are post-activation.
  if (
    status === "active" ||
    status === "clone_suspected" ||
    status === "cloned"
  ) {
    return "active";
  }
  return status;
}

function cloneState(status: string): string {
  if (status === "clone_suspected" || status === "cloned") return status;
  return "none";
}

function parsePassport(data: unknown): ResolverPassport | null {
  const root = asRecord(data);
  if (!root || typeof root.status !== "string" || !root.status) return null;
  return data as ResolverPassport;
}

async function readPassport(
  id: string,
  fetchImpl: FetchLike
): Promise<ResolverPassport | "error"> {
  const url = resolverPassportUrl(id);
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok && res.status !== 404) return "error";
    const data: unknown = await res.json();
    const parsed = parsePassport(data);
    if (!parsed) return "error";
    if (res.status === 404 && parsed.status !== "not_found") return "error";
    return parsed;
  } catch {
    return "error";
  }
}

function badgeCss(status?: string): string {
  if (!status) return "";
  const cls = badgeClass(status);
  const color = STATUS_TONE[status] ?? "#5a5a5a";
  return `.badge { display:inline-block; padding:.35rem .75rem; border-radius:999px; color:#fff;
         font-weight:600; font-size:.95rem; }
.${cls} { background:${color}; }`;
}

function pageShell(opts: {
  title: string;
  statusCode: number;
  body: string;
  status?: string;
}): Response {
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(opts.title)}</title>
<style>
:root { color-scheme: light dark; }
body { margin:0; padding:2rem 1.25rem; font:16px/1.55 ui-sans-serif,system-ui,sans-serif;
       background:#fafafa; color:#141414; }
main { max-width:34rem; margin:0 auto; }
h1 { font-size:1.5rem; margin:.4rem 0 .75rem; }
dl { display:grid; grid-template-columns:auto 1fr; gap:.4rem 1rem; margin:1.25rem 0; }
dt { color:#666; font-size:.9rem; }
dd { margin:0; word-break:break-all; }
.claims { border:1px solid #e2e2e2; border-radius:.6rem; padding:1rem; background:#fff; margin:1.25rem 0; }
.claims p { margin:.4rem 0; font-size:.94rem; }
.claims strong { display:block; color:#444; font-size:.8rem; text-transform:uppercase;
                 letter-spacing:.04em; margin-bottom:.15rem; }
.note { font-size:.9rem; color:#444; }
${badgeCss(opts.status)}
footer { margin-top:2rem; font-size:.82rem; color:#777; }
@media (prefers-color-scheme: dark) {
  body { background:#101010; color:#f2f2f2; }
  .claims { background:#1a1a1a; border-color:#2e2e2e; }
  dt, footer, .note { color:#9a9a9a; }
}
</style></head><body><main>
${opts.body}
</main></body></html>`;
  return new Response(html, {
    status: opts.statusCode,
    headers: {
      ...HTML_SECURITY_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

function failClosedPage(): Response {
  return pageShell({
    title: "Could not verify — AuthiChain",
    statusCode: 503,
    body: `<h1>Could not verify</h1>
<p class="note">${esc(COULD_NOT_VERIFY)}</p>
<footer>
<p>Product seals are in development. This page does not prove a physical object is genuine.</p>
</footer>`,
  });
}

function unknownPage(id: string, payload: ResolverPassport): Response {
  const proves = String(payload.proves ?? "");
  const doesNot = String(payload.doesNotProve ?? "");
  const label = String(payload.label ?? "Not found");
  return pageShell({
    title: `${label} — AuthiChain`,
    statusCode: 404,
    body: `<h1>${esc(label)}</h1>
<p class="note">Identifier <code>${esc(id)}</code> is not in the registry.</p>
<div class="claims">
<p><strong>What this shows</strong>${esc(proves)}</p>
<p><strong>What it does not show</strong>${esc(doesNot)}</p>
</div>
<footer>
<p>Product seals are in development. This page does not prove a physical object is genuine. It is a read-only check of the public resolver and does not record a scan.</p>
</footer>`,
  });
}

function badgeClass(status: string): string {
  if (status === "clone_suspected") return "badge-suspect";
  if (isWarningStatus(status)) return "badge-warn";
  if (status === "issued") return "badge-issued";
  if (status === "not_found") return "badge-unknown";
  return "badge-ok";
}

function knownPage(id: string, payload: ResolverPassport): Response {
  const status = String(payload.status);
  const productName = payload.product?.name ?? "";
  const productBrand = payload.product?.brand ?? "";
  const product =
    [productName, productBrand].filter(Boolean).join(" · ") || "—";
  const serial =
    payload.identifier?.serial || payload.identifier?.certId || "—";
  const proves = String(payload.proves ?? "");
  const doesNot = String(payload.doesNotProve ?? "");
  const label = displayLabel(status, payload.label);
  const warning = isWarningStatus(status);
  const signature = payloadHasJws(payload) ? "jws present" : "unsigned";
  const tone =
    STATUS_TONE[status] ?? (warning ? STATUS_TONE.cloned : STATUS_TONE.active);
  return pageShell({
    title: `${label} — AuthiChain`,
    statusCode: 200,
    status,
    body: `<span class="badge ${badgeClass(status)}" style="background:${esc(tone)}">${esc(label)}</span>
<h1>${esc(product === "—" ? `Seal ${id}` : product)}</h1>
<p class="note">Read-only resolver check for <code>${esc(id)}</code>. Product seals are in development. This page does not prove a physical object is genuine.</p>
<div class="claims">
<p><strong>What this shows</strong>${esc(proves)}</p>
<p><strong>What it does not show</strong>${esc(doesNot)}</p>
</div>
<dl>
<dt>Product</dt><dd>${esc(product)}</dd>
<dt>Serial</dt><dd>${esc(serial)}</dd>
<dt>Issuance status</dt><dd>${esc(issuanceStatus(status))}</dd>
<dt>Clone state</dt><dd>${esc(cloneState(status))}</dd>
<dt>Signature</dt><dd>${esc(signature)}</dd>
<dt>Resolver status</dt><dd>${esc(status)} — ${esc(label)}</dd>
</dl>
<footer>
<p>Values come from GET ${esc(resolverPassportUrl(id))}. This view does not record a scan and does not inspect a physical item.</p>
</footer>`,
  });
}

export async function tryHandleSealVerify(
  request: Request,
  fetchImpl: FetchLike = (input, init) => fetch(input, init)
): Promise<Response | null> {
  const match = matchSealVerifyPath(new URL(request.url).pathname);
  if (!match) return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" },
    });
  }
  if (!match.ok) {
    const failed = failClosedPage();
    if (request.method === "HEAD") {
      return new Response(null, {
        status: failed.status,
        headers: failed.headers,
      });
    }
    return failed;
  }
  const payload = await readPassport(match.id, fetchImpl);
  const page =
    payload === "error"
      ? failClosedPage()
      : payload.status === "not_found"
        ? unknownPage(match.id, payload)
        : knownPage(match.id, payload);
  if (request.method === "HEAD") {
    return new Response(null, { status: page.status, headers: page.headers });
  }
  return page;
}
