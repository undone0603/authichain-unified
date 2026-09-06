/**
 * gs1-resolver — GS1 Digital Link resolver for AuthiChain seals.
 *
 * Resolves on-pack Digital Link URIs (e.g. /01/09506000149301/21/SN123)
 * against the D1 seal registry, records the scan with coarse geo from
 * Cloudflare, and runs the clone state machine over scan history.
 *
 * Honesty rules this worker follows:
 *   - An unknown identifier resolves to `not_found`. It is never upgraded to
 *     "authentic", and `not_found` is not presented as proof of counterfeit.
 *   - Every response carries the STATUS_COPY `proves` / `doesNot` pair, so a
 *     caller cannot read more into a green result than it supports.
 *   - Nothing is invented when the registry has no record.
 */
import {
  parseGs1Path,
  lookupKey,
  hasResolvableId,
  isResolverPath,
  toDigitalLink,
  type Gs1Fields,
} from "./gs1";
import {
  nextStatus,
  STATUS_COPY,
  type ScanEvent,
  type SealStatus,
} from "./clone";

export interface Env {
  DB: D1Database;
  PASSPORT_ORIGIN: string;
  RESOLVER_ORIGIN: string;
  ISSUE_SECRET?: string;
}

type SealRow = {
  id: string;
  lookup_key: string;
  gtin: string | null;
  lot: string | null;
  serial: string | null;
  cert_id: string;
  brand: string | null;
  product_name: string | null;
  issuer: string | null;
  chain: string | null;
  contract: string | null;
  tx_hash: string | null;
  status: string;
  status_reason: string | null;
  first_country: string | null;
  first_activated_at: number | null;
  scan_count: number;
  last_scan_at: number | null;
  metadata_json: string | null;
  created_at: number;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...JSON_HEADERS, ...extra },
  });
}

function wantsJson(request: Request, url: URL): boolean {
  const fmt = url.searchParams.get("format");
  if (fmt === "json") return true;
  if (fmt === "html") return false;
  const accept = request.headers.get("accept") || "";
  // A browser sends text/html first; a scanner/API client typically does not.
  if (accept.includes("text/html")) return false;
  return accept.includes("application/json") || accept.includes("application/ld+json") || accept === "";
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Coarse geo from Cloudflare. Absent in `wrangler dev --local`. */
function geoOf(request: Request): { country: string; region?: string; colo?: string } {
  const cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf;
  return {
    country: (cf?.country as string) || "ZZ",
    region: (cf?.region as string) || undefined,
    colo: (cf?.colo as string) || undefined,
  };
}

async function loadSeal(env: Env, key: string): Promise<SealRow | null> {
  return await env.DB.prepare("SELECT * FROM seals WHERE lookup_key = ?1")
    .bind(key)
    .first<SealRow>();
}

async function recentScans(env: Env, sealId: string, limit = 50): Promise<ScanEvent[]> {
  const { results } = await env.DB.prepare(
    "SELECT at, country, region FROM scans WHERE seal_id = ?1 ORDER BY at DESC LIMIT ?2",
  )
    .bind(sealId, limit)
    .all<{ at: number; country: string; region: string | null }>();
  return (results ?? []).map((r) => ({
    at: r.at,
    country: r.country,
    region: r.region ?? undefined,
  }));
}

/**
 * Record the scan and advance the seal's status.
 *
 * Writes are best-effort: a resolve must still return a correct answer if the
 * write leg fails, but it must not then claim the scan was recorded.
 */
async function registerScan(env: Env, seal: SealRow, request: Request) {
  const now = Date.now();
  const geo = geoOf(request);
  const incoming: ScanEvent = { at: now, country: geo.country, region: geo.region };
  const history = await recentScans(env, seal.id);
  const transition = nextStatus(seal.status as SealStatus, history, incoming);

  const scanId = crypto.randomUUID();
  const isFirst = seal.scan_count === 0;

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO scans (id, seal_id, at, country, region, colo, result, reason)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      ).bind(
        scanId,
        seal.id,
        now,
        geo.country,
        geo.region ?? null,
        geo.colo ?? null,
        transition.next,
        transition.reason,
      ),
      env.DB.prepare(
        `UPDATE seals
            SET status = ?1,
                status_reason = ?2,
                scan_count = scan_count + 1,
                last_scan_at = ?3,
                first_country = COALESCE(first_country, ?4),
                first_activated_at = COALESCE(first_activated_at, ?5)
          WHERE id = ?6`,
      ).bind(
        transition.next,
        transition.reason,
        now,
        isFirst ? geo.country : null,
        isFirst ? now : null,
        seal.id,
      ),
    ]);
    return { transition, recorded: true, at: now, geo };
  } catch (err) {
    console.error("scan write failed", { sealId: seal.id, err: String(err) });
    return { transition, recorded: false, at: now, geo };
  }
}

function passportPayload(
  seal: SealRow | null,
  status: SealStatus,
  fields: Gs1Fields,
  env: Env,
  extra: {
    reason?: string;
    recorded?: boolean;
    scanCount?: number;
    firstCountry?: string | null;
    firstActivatedAt?: number | null;
  } = {},
) {
  const copy = STATUS_COPY[status];
  let metadata: unknown = undefined;
  if (seal?.metadata_json) {
    try {
      metadata = JSON.parse(seal.metadata_json);
    } catch {
      metadata = undefined;
    }
  }

  return {
    status,
    label: copy.label,
    // Shipped on every response so a caller cannot over-read a green result.
    proves: copy.proves,
    doesNotProve: copy.doesNot,
    reason: extra.reason,
    scanRecorded: extra.recorded ?? false,
    identifier: {
      gtin: fields.gtin ?? seal?.gtin ?? null,
      lot: fields.lot ?? seal?.lot ?? null,
      serial: fields.serial ?? seal?.serial ?? null,
      certId: seal?.cert_id ?? fields.certId ?? null,
      digitalLink: toDigitalLink(env.RESOLVER_ORIGIN, fields),
    },
    product: seal
      ? {
          brand: seal.brand,
          name: seal.product_name,
          issuer: seal.issuer,
        }
      : null,
    anchor: seal?.tx_hash
      ? { chain: seal.chain, contract: seal.contract, txHash: seal.tx_hash }
      : null,
    history: seal
      ? {
          scanCount: extra.scanCount ?? seal.scan_count,
          firstCountry: extra.firstCountry !== undefined ? extra.firstCountry : seal.first_country,
          firstActivatedAt:
            extra.firstActivatedAt !== undefined ? extra.firstActivatedAt : seal.first_activated_at,
        }
      : null,
    metadata,
    // passportUrl intentionally omitted. PASSPORT_ORIGIN + /passport/{certId}
    // has no route on authichain.com as of 2026-09-04 -- it serves the
    // marketing homepage for ANY cert id (identical bytes for a real and a
    // nonsense id, canonical pointing at the site root), so linking there
    // dead-ends a scan on a marketing page. This response IS the passport
    // until that page exists; re-add the link once it does.
    passportUrl: null,
  };
}

const STATUS_TONE: Record<SealStatus, string> = {
  active: "#0f7b3f",
  issued: "#8a6d00",
  clone_suspected: "#b25e00",
  cloned: "#a5122a",
  revoked: "#a5122a",
  not_found: "#5a5a5a",
};

function passportHtml(payload: ReturnType<typeof passportPayload>): string {
  const tone = STATUS_TONE[payload.status as SealStatus] ?? "#5a5a5a";
  const id = payload.identifier;
  const rows: Array<[string, string | null]> = [
    ["GTIN", id.gtin],
    ["Lot", id.lot],
    ["Serial", id.serial],
    ["Certificate", id.certId],
    ["Brand", payload.product?.brand ?? null],
    ["Product", payload.product?.name ?? null],
    ["Issuer", payload.product?.issuer ?? null],
  ];
  const anchor = payload.anchor;

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(payload.label)} — AuthiChain</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; padding:2rem 1.25rem; font:16px/1.55 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
         background:#fafafa; color:#141414; }
  main { max-width:34rem; margin:0 auto; }
  .badge { display:inline-block; padding:.35rem .75rem; border-radius:999px; color:#fff;
           background:${tone}; font-weight:600; font-size:.95rem; }
  h1 { font-size:1.5rem; margin:.9rem 0 .35rem; }
  dl { display:grid; grid-template-columns:auto 1fr; gap:.4rem 1rem; margin:1.25rem 0; }
  dt { color:#666; font-size:.9rem; }
  dd { margin:0; font-variant-numeric:tabular-nums; word-break:break-all; }
  .claims { border:1px solid #e2e2e2; border-radius:.6rem; padding:1rem; background:#fff; margin:1.25rem 0; }
  .claims p { margin:.4rem 0; font-size:.94rem; }
  .claims strong { display:block; color:#444; font-size:.8rem; text-transform:uppercase;
                   letter-spacing:.04em; margin-bottom:.15rem; }
  footer { margin-top:2rem; font-size:.82rem; color:#777; }
  a { color:#0b5cd5; }
  @media (prefers-color-scheme: dark) {
    body { background:#101010; color:#f2f2f2; }
    .claims { background:#1a1a1a; border-color:#2e2e2e; }
    dt, footer { color:#9a9a9a; }
  }
</style></head><body><main>
  <span class="badge">${esc(payload.label)}</span>
  <h1>${esc(payload.product?.name || payload.product?.brand || "Product passport")}</h1>
  <div class="claims">
    <p><strong>What this shows</strong>${esc(payload.proves)}</p>
    <p><strong>What it does not show</strong>${esc(payload.doesNotProve)}</p>
  </div>
  <dl>
    ${rows
      .filter(([, v]) => v)
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
      .join("\n    ")}
    ${
      payload.history
        ? `<dt>Scans</dt><dd>${esc(payload.history.scanCount)}${
            payload.history.firstCountry ? ` (first: ${esc(payload.history.firstCountry)})` : ""
          }</dd>`
        : ""
    }
    ${
      anchor
        ? `<dt>On-chain</dt><dd>${esc(anchor.chain)} · ${esc(anchor.txHash)}</dd>`
        : ""
    }
  </dl>
  ${
    payload.scanRecorded
      ? ""
      : `<p style="font-size:.85rem;color:#a5122a">This scan was not recorded (registry write unavailable).</p>`
  }
  <footer>
    Resolved via GS1 Digital Link.
    ${payload.passportUrl ? `<a href="${esc(payload.passportUrl)}">Full passport</a> ·` : ""}
    <a href="?format=json">JSON</a>
  </footer>
</main></body></html>`;
}

/** GS1 Conformant Resolver description — standard discovery document. */
function wellKnown(env: Env) {
  return {
    resolverRoot: env.RESOLVER_ORIGIN,
    supportedPrimaryKeys: ["01"],
    supportedLinkType: ["gs1:pip", "gs1:certificationInfo", "gs1:epcis"],
    name: "AuthiChain GS1 Digital Link resolver",
    // Declared here rather than implied: this resolver answers identity and
    // scan-pattern questions only.
    documentation: `${env.PASSPORT_ORIGIN}/docs/resolver`,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "content-type,authorization",
        },
      });
    }

    if (url.pathname === "/health") {
      return json({ ok: true, service: "gs1-resolver" });
    }

    if (url.pathname === "/.well-known/gs1resolver") {
      return json(wellKnown(env));
    }

    if (url.pathname === "/issue" && request.method === "POST") {
      return handleIssue(request, env);
    }

    if (url.pathname === "/" ) {
      return json({
        service: "gs1-resolver",
        usage: `${env.RESOLVER_ORIGIN}/01/{gtin}/21/{serial}`,
        wellKnown: `${env.RESOLVER_ORIGIN}/.well-known/gs1resolver`,
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "method_not_allowed" }, 405);
    }

    if (!isResolverPath(url.pathname)) {
      return json({ error: "not_a_digital_link_path", path: url.pathname }, 404);
    }

    const fields = parseGs1Path(url.pathname, url.search);
    if (!hasResolvableId(fields)) {
      return json({ error: "no_resolvable_identifier", path: url.pathname }, 400);
    }

    const seal = await loadSeal(env, lookupKey(fields));

    if (!seal) {
      const payload = passportPayload(null, "not_found", fields, env, {
        reason: "unknown_seal",
        recorded: false,
      });
      return wantsJson(request, url)
        ? json(payload, 404)
        : new Response(passportHtml(payload), {
            status: 404,
            headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
          });
    }

    const { transition, recorded, at, geo } = await registerScan(env, seal, request);
    const isFirst = seal.scan_count === 0;
    const payload = passportPayload(seal, transition.next, fields, env, {
      reason: transition.reason,
      recorded,
      scanCount: seal.scan_count + (recorded ? 1 : 0),
      firstCountry: isFirst && recorded ? geo.country : seal.first_country,
      firstActivatedAt: isFirst && recorded ? at : seal.first_activated_at,
    });

    return wantsJson(request, url)
      ? json(payload)
      : new Response(passportHtml(payload), {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
  },
};

/** Register a seal. Requires ISSUE_SECRET; refuses outright if unset. */
async function handleIssue(request: Request, env: Env): Promise<Response> {
  if (!env.ISSUE_SECRET) {
    return json({ error: "issuing_disabled", detail: "ISSUE_SECRET is not configured." }, 503);
  }
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${env.ISSUE_SECRET}`) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const certId = typeof body.certId === "string" ? body.certId : null;
  if (!certId) return json({ error: "certId_required" }, 400);

  const fields = parseGs1Path(
    typeof body.gtin === "string" ? `/01/${body.gtin}` : `/cert/${certId}`,
    "",
  );
  if (typeof body.lot === "string") fields.lot = body.lot;
  if (typeof body.serial === "string") fields.serial = body.serial;
  if (!fields.certId) fields.certId = certId;

  const key = lookupKey(fields);
  const id = crypto.randomUUID();

  try {
    await env.DB.prepare(
      `INSERT INTO seals (id, lookup_key, gtin, lot, serial, cert_id, brand, product_name,
                          issuer, chain, contract, tx_hash, status, metadata_json, created_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'issued',?13,?14)`,
    )
      .bind(
        id,
        key,
        fields.gtin ?? null,
        fields.lot ?? null,
        fields.serial ?? null,
        certId,
        (body.brand as string) ?? null,
        (body.productName as string) ?? null,
        (body.issuer as string) ?? null,
        (body.chain as string) ?? "polygon",
        (body.contract as string) ?? null,
        (body.txHash as string) ?? null,
        body.metadata ? JSON.stringify(body.metadata) : null,
        Date.now(),
      )
      .run();
  } catch (err) {
    const message = String(err);
    if (message.includes("UNIQUE")) {
      return json({ error: "already_issued", lookupKey: key }, 409);
    }
    console.error("issue failed", message);
    return json({ error: "issue_failed" }, 500);
  }

  return json(
    {
      id,
      lookupKey: key,
      certId,
      status: "issued",
      digitalLink: toDigitalLink(env.RESOLVER_ORIGIN, fields),
    },
    201,
  );
}
