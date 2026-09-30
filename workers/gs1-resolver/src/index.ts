/**
 * gs1-resolver — GS1 Digital Link resolver for AuthiChain seals.
 *
 * Resolves on-pack Digital Link URIs (e.g. /01/09506000149301/21/SN123)
 * against the D1 seal registry the way GS1's Conformant Resolver standard
 * describes: a linkset on request, a 307 to the requested link type, and
 * otherwise a 307 to the default link. For a registered item the default link
 * is /verify/..., which records the scan with coarse geo from Cloudflare and
 * runs the clone state machine over scan history.
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
  toDigitalLink,
  type Gs1Fields,
} from "./gs1";
import {
  parseDigitalLink,
  levelPaths,
  looksCompressed,
  normalizeLinkType,
  findLinks,
  toLinkset,
  wantsLinkset,
  withQuery,
  LINKSET_CONTEXT,
  type DigitalLink,
  type Level,
} from "./dl";
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
  return (
    accept.includes("application/json") ||
    accept.includes("application/ld+json") ||
    accept === ""
  );
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Coarse geo from Cloudflare. Absent in `wrangler dev --local`. */
function geoOf(request: Request): {
  country: string;
  region?: string;
  colo?: string;
} {
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

async function recentScans(
  env: Env,
  sealId: string,
  limit = 50
): Promise<ScanEvent[]> {
  const { results } = await env.DB.prepare(
    "SELECT at, country, region FROM scans WHERE seal_id = ?1 ORDER BY at DESC LIMIT ?2"
  )
    .bind(sealId, limit)
    .all<{ at: number; country: string; region: string | null }>();
  return (results ?? []).map(r => ({
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
  const incoming: ScanEvent = {
    at: now,
    country: geo.country,
    region: geo.region,
  };
  const history = await recentScans(env, seal.id);
  const transition = nextStatus(seal.status as SealStatus, history, incoming);

  const scanId = crypto.randomUUID();
  const isFirst = seal.scan_count === 0;

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO scans (id, seal_id, at, country, region, colo, result, reason)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      ).bind(
        scanId,
        seal.id,
        now,
        geo.country,
        geo.region ?? null,
        geo.colo ?? null,
        transition.next,
        transition.reason
      ),
      env.DB.prepare(
        `UPDATE seals
            SET status = ?1,
                status_reason = ?2,
                scan_count = scan_count + 1,
                last_scan_at = ?3,
                first_country = COALESCE(first_country, ?4),
                first_activated_at = COALESCE(first_activated_at, ?5)
          WHERE id = ?6`
      ).bind(
        transition.next,
        transition.reason,
        now,
        isFirst ? geo.country : null,
        isFirst ? now : null,
        seal.id
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
  } = {}
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
          firstCountry:
            extra.firstCountry !== undefined
              ? extra.firstCountry
              : seal.first_country,
          firstActivatedAt:
            extra.firstActivatedAt !== undefined
              ? extra.firstActivatedAt
              : seal.first_activated_at,
        }
      : null,
    metadata,
    // Re-enabled 2026-09-11: /passport/{certId} now renders a real passport
    // (src/app/passport/[id]), so a scan no longer dead-ends on a marketing
    // page. That page reads through /v1/passport/{id}, which does not register
    // a scan, so following this link cannot advance the seal's state.
    // Only linked for a seal we actually resolved — a not_found response has
    // nothing to link to.
    passportUrl: seal?.cert_id
      ? `${stripTrailingSlashes(env.PASSPORT_ORIGIN)}/passport/${encodeURIComponent(seal.cert_id)}`
      : null,
  };
}

/**
 * Strips trailing slashes in linear time.
 *
 * Replaces `.replace(/\/+$/, "")`, which CodeQL flagged as a polynomial
 * regular expression on uncontrolled data: an anchored `+` backtracks
 * quadratically over a run of slashes. These origins come from configuration
 * rather than from a request, so the practical exposure was small — but the
 * regex buys nothing over a scan, so there is no reason to keep it.
 */
function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47 /* "/" */) end--;
  return value.slice(0, end);
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
            payload.history.firstCountry
              ? ` (first: ${esc(payload.history.firstCountry)})`
              : ""
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

/**
 * Resolver description document (/.well-known/gs1resolver).
 *
 * History: until 2026-09-11 this called itself a "GS1 Conformant Resolver"
 * and advertised link types nothing here could serve. It was then cut back to
 * an honest "not conformant" note and an empty supportedLinkType. On
 * 2026-09-30 the resolution behaviour was implemented (linksets, linkType
 * redirects, default link, walk-up, compressed URIs), so the document now
 * lists the link types that are really served, and nothing more.
 *
 * It makes no conformance claim. Whether this passes GS1's hosted test suite
 * is a fact to be established by running it, not asserted here;
 * docs/GS1_CONFORMANCE.md records the result. The field set follows GS1's
 * Resolver Community Edition description file, because the schema at
 * ref.gs1.org could not be fetched from the build environment.
 */
function wellKnown(env: Env) {
  return {
    name: "AuthiChain GS1 Digital Link resolver",
    resolverRoot: env.RESOLVER_ORIGIN,
    supportedPrimaryKeys: ["01"],
    supportedLinkType: [{ namespace: "https://gs1.org/voc/", prefix: "gs1:" }],
    linkTypeDefaultCanBeAll: false,
    supportsLanguageVariants: false,
    supportsSemanticInterpretation: false,
    validatesAIcombinations: false,
    activeLinkTypes: {
      en: {
        "gs1:defaultLink": {
          title: "Default link",
          description:
            "For a registered item, the AuthiChain verification result for that item. Following it records a scan. For a GTIN, a page saying which items are registered, which verifies none of them.",
          url: "https://gs1.org/voc/defaultLink",
        },
        "gs1:certificationInfo": {
          title: "Certification Information",
          description:
            "The AuthiChain passport for the item's certificate. Reading it records no scan.",
          url: "https://gs1.org/voc/certificationInfo",
        },
      },
    },
  };
}

const DL_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-expose-headers": "Link, Location",
  "cache-control": "no-store",
  vary: "Accept",
};

function dlResponse(
  request: Request,
  status: number,
  headers: Record<string, string>,
  body: string | null
): Response {
  return new Response(request.method === "HEAD" ? null : body, {
    status,
    headers: { ...DL_HEADERS, ...headers },
  });
}

function dlJson(
  request: Request,
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return dlResponse(
    request,
    status,
    { "content-type": "application/json; charset=utf-8", ...headers },
    JSON.stringify(body, null, 2)
  );
}

type ProductSummary = {
  registeredItems: number;
  brand: string | null;
  productName: string | null;
  issuer: string | null;
};

/** What the registry knows about a GTIN as a whole, across its seals. */
async function loadProduct(
  env: Env,
  gtin: string
): Promise<ProductSummary | null> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n, MAX(brand) AS brand, MAX(product_name) AS product_name,
            MAX(issuer) AS issuer
       FROM seals WHERE gtin = ?1`
  )
    .bind(gtin)
    .first<{
      n: number;
      brand: string | null;
      product_name: string | null;
      issuer: string | null;
    }>();
  const n = Number(row?.n ?? 0);
  if (!row || !(n > 0)) return null;
  return {
    registeredItems: n,
    brand: row.brand,
    productName: row.product_name,
    issuer: row.issuer,
  };
}

/**
 * The linkset for a Digital Link and every level above it, most granular
 * first. Also reports whether the requested serial is registered, because an
 * unregistered serial must not walk up (see handleDigitalLink).
 */
async function loadLevels(
  env: Env,
  dl: DigitalLink,
  origin: string
): Promise<{ levels: Level[]; serialRegistered: boolean }> {
  const levels: Level[] = [];
  let serialRegistered = false;
  for (const path of levelPaths(dl)) {
    const anchor = `${origin}${path}`;
    const tail = path.split("/").filter(Boolean);
    const ai = tail.length > 2 ? tail[tail.length - 2] : "01";
    let seal: SealRow | null = null;
    if (ai === "21")
      seal = await loadSeal(env, `gtin:${dl.gtin}:ser:${dl.serial}`);
    else if (ai === "10")
      seal = await loadSeal(env, `gtin:${dl.gtin}:lot:${dl.lot}`);
    else if (ai === "01") seal = await loadSeal(env, `gtin:${dl.gtin}`);
    if (ai === "21" && seal) serialRegistered = true;

    const level: Level = { anchor, links: {} };
    if (seal) {
      level.description = seal.product_name || seal.brand || undefined;
      level.links.defaultLink = [
        {
          href: `${origin}/verify${path}`,
          title: "Verify this item with AuthiChain",
        },
      ];
      if (seal.cert_id) {
        level.links.certificationInfo = [
          {
            href: `${stripTrailingSlashes(env.PASSPORT_ORIGIN)}/passport/${encodeURIComponent(seal.cert_id)}`,
            title: "AuthiChain passport",
            type: "text/html",
          },
        ];
      }
    } else if (ai === "01") {
      const product = await loadProduct(env, dl.gtin);
      if (product) {
        level.description = product.productName || product.brand || undefined;
        level.links.defaultLink = [
          {
            href: `${origin}/verify${path}`,
            title: "Product registered with AuthiChain",
          },
        ];
      }
    }
    levels.push(level);
  }
  return { levels, serialRegistered };
}

/**
 * GS1-Conformant resolution of a Digital Link URI.
 *
 * Nothing here records a scan. Resolution answers "where do links for this
 * identifier go"; the scan is recorded by the /verify target a person lands
 * on (the default link), and only for a GET there. So a HEAD, a linkset
 * request, a crawler, or GS1's test suite probing the URI cannot advance a
 * seal toward clone_suspected.
 */
async function handleDigitalLink(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const parsed = parseDigitalLink(url);
  if (!parsed.ok) {
    return dlJson(request, parsed.status, {
      error: parsed.error,
      detail: parsed.detail,
      path: url.pathname,
    });
  }
  const dl = parsed.dl;
  const origin = url.origin;
  const anchor = `${origin}${dl.path}`;

  const link: string[] = [
    `<${anchor}?linkType=linkset>; rel="linkset"; type="application/linkset+json"`,
  ];
  if (dl.uncompressedUri)
    link.push(`<${dl.uncompressedUri}>; rel="owl:sameAs"`);

  const { levels, serialRegistered } = await loadLevels(env, dl, origin);
  const available = levels.some(l => Object.keys(l.links).length > 0);

  // Honesty rule: an unregistered serial is not_found. Walking it up to the
  // GTIN would land someone holding an unknown (possibly counterfeit) serial
  // on a page for the genuine product. Lot and variant do walk up.
  if ((dl.serial && !serialRegistered) || !available) {
    const fields: Gs1Fields = {
      gtin: dl.gtin,
      lot: dl.lot,
      serial: dl.serial,
      variant: dl.variant,
      rawPath: dl.path,
    };
    const payload = passportPayload(null, "not_found", fields, env, {
      reason:
        dl.serial && !serialRegistered ? "unknown_seal" : "unknown_identifier",
      recorded: false,
    });
    return wantsJson(request, url)
      ? dlJson(request, 404, payload)
      : dlResponse(
          request,
          404,
          { "content-type": "text/html; charset=utf-8" },
          passportHtml(payload)
        );
  }

  if (wantsLinkset(request, url)) {
    link.push(
      `<${LINKSET_CONTEXT}>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"`
    );
    return dlResponse(
      request,
      200,
      { "content-type": "application/linkset+json", link: link.join(", ") },
      JSON.stringify(toLinkset(levels), null, 2)
    );
  }

  const requested = url.searchParams.get("linkType");
  const term =
    requested === null ? "defaultLink" : normalizeLinkType(requested);
  const links = term ? findLinks(levels, term) : null;
  if (!links) {
    return dlJson(
      request,
      404,
      { error: "link_type_not_available", linkType: requested, path: dl.path },
      { link: link.join(", ") }
    );
  }
  if (links.length > 1) {
    return dlJson(
      request,
      300,
      { linkType: requested, links },
      { link: link.join(", ") }
    );
  }
  return dlResponse(
    request,
    307,
    { location: withQuery(links[0].href, url.search), link: link.join(", ") },
    null
  );
}

/**
 * The verification response for an identifier: the passport payload as HTML
 * or JSON. This is the default link target, and the legacy /cert/{id} scan
 * surface. A GET records the scan and may advance the seal's status; a HEAD
 * reads without recording.
 */
async function handleVerify(
  request: Request,
  env: Env,
  url: URL,
  path: string
): Promise<Response> {
  const fields = parseGs1Path(path, url.search);
  if (!hasResolvableId(fields)) {
    return json({ error: "no_resolvable_identifier", path: url.pathname }, 400);
  }

  const seal = await loadSeal(env, lookupKey(fields));

  if (!seal) {
    // A GTIN on its own may still name a registered product.
    if (fields.gtin && !fields.lot && !fields.serial && !fields.certId) {
      const product = await loadProduct(env, fields.gtin);
      if (product) return productResponse(request, url, env, fields, product);
    }
    const payload = passportPayload(null, "not_found", fields, env, {
      reason: "unknown_seal",
      recorded: false,
    });
    return wantsJson(request, url)
      ? json(payload, 404)
      : new Response(passportHtml(payload), {
          status: 404,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
          },
        });
  }

  if (request.method !== "GET") {
    return json(
      passportPayload(seal, seal.status as SealStatus, fields, env, {
        reason: "read_only",
        recorded: false,
      })
    );
  }

  const { transition, recorded, at, geo } = await registerScan(
    env,
    seal,
    request
  );
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
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
}

const PRODUCT_COPY = {
  label: "Product registered",
  proves:
    "Items carrying this GTIN have been registered with AuthiChain by the issuer named here.",
  doesNot:
    "It does not verify any single item. Scan the code on the item itself, which carries its serial number, to check that item.",
};

/** GTIN-level page: what is registered under the GTIN. Records nothing. */
function productResponse(
  request: Request,
  url: URL,
  env: Env,
  fields: Gs1Fields,
  product: ProductSummary
): Response {
  const body = {
    status: "product_registered",
    label: PRODUCT_COPY.label,
    proves: PRODUCT_COPY.proves,
    doesNotProve: PRODUCT_COPY.doesNot,
    scanRecorded: false,
    identifier: {
      gtin: fields.gtin,
      digitalLink: toDigitalLink(env.RESOLVER_ORIGIN, {
        rawPath: "",
        gtin: fields.gtin,
      }),
    },
    product: {
      brand: product.brand,
      name: product.productName,
      issuer: product.issuer,
    },
    registeredItems: product.registeredItems,
  };
  if (wantsJson(request, url)) return json(body);
  const rows: Array<[string, string | number | null | undefined]> = [
    ["GTIN", fields.gtin],
    ["Brand", product.brand],
    ["Product", product.productName],
    ["Issuer", product.issuer],
    ["Registered items", product.registeredItems],
  ];
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(PRODUCT_COPY.label)} — AuthiChain</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; padding:2rem 1.25rem; font:16px/1.55 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
         background:#fafafa; color:#141414; }
  main { max-width:34rem; margin:0 auto; }
  h1 { font-size:1.5rem; margin:0 0 .35rem; }
  dl { display:grid; grid-template-columns:auto 1fr; gap:.4rem 1rem; margin:1.25rem 0; }
  dt { color:#666; font-size:.9rem; }
  dd { margin:0; word-break:break-all; }
  .claims { border:1px solid #e2e2e2; border-radius:.6rem; padding:1rem; background:#fff; margin:1.25rem 0; }
  .claims p { margin:.4rem 0; font-size:.94rem; }
  .claims strong { display:block; color:#444; font-size:.8rem; text-transform:uppercase; letter-spacing:.04em; }
  @media (prefers-color-scheme: dark) {
    body { background:#101010; color:#f2f2f2; }
    .claims { background:#1a1a1a; border-color:#2e2e2e; }
    dt { color:#9a9a9a; }
  }
</style></head><body><main>
  <h1>${esc(product.productName || product.brand || PRODUCT_COPY.label)}</h1>
  <div class="claims">
    <p><strong>What this shows</strong>${esc(PRODUCT_COPY.proves)}</p>
    <p><strong>What it does not show</strong>${esc(PRODUCT_COPY.doesNot)}</p>
  </div>
  <dl>
    ${rows
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
      .join("\n    ")}
  </dl>
</main></body></html>`;
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,HEAD,POST,OPTIONS",
          "access-control-allow-headers": "accept,content-type,authorization",
          "access-control-expose-headers": "Link, Location",
          "access-control-max-age": "86400",
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

    // Read-only passport lookup, for surfaces that render a passport without a
    // person having scanned anything.
    //
    // Deliberately does NOT call registerScan. A page render is not a scan:
    // counting one would inflate scan_count, and because the app renders from
    // more than one region, repeated renders look exactly like the multi-region
    // burst that drives active -> clone_suspected. A viewer refreshing a
    // passport must never be able to mark the seal as cloned.
    //
    // The /verify and /cert scan surfaces below still advance state; this
    // endpoint only reports it.
    if (url.pathname.startsWith("/v1/passport/")) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return json({ error: "method_not_allowed" }, 405);
      }
      const rawId = url.pathname.slice("/v1/passport/".length);
      if (!rawId) return json({ error: "no_resolvable_identifier" }, 400);
      const fields = parseGs1Path(`/cert/${rawId}`, "");
      if (!hasResolvableId(fields)) {
        return json(
          { error: "no_resolvable_identifier", path: url.pathname },
          400
        );
      }
      const found = await loadSeal(env, lookupKey(fields));
      if (!found) {
        return json(
          passportPayload(null, "not_found", fields, env, {
            reason: "unknown_seal",
            recorded: false,
          }),
          404
        );
      }
      return json(
        passportPayload(found, found.status as SealStatus, fields, env, {
          reason: "read_only",
          recorded: false,
        })
      );
    }

    if (url.pathname === "/") {
      return json({
        service: "gs1-resolver",
        usage: `${env.RESOLVER_ORIGIN}/01/{gtin}/21/{serial}`,
        linkset: `${env.RESOLVER_ORIGIN}/01/{gtin}/21/{serial}?linkType=linkset`,
        wellKnown: `${env.RESOLVER_ORIGIN}/.well-known/gs1resolver`,
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "method_not_allowed" }, 405, {
        allow: "GET, HEAD, OPTIONS",
      });
    }

    // Default-link target: the verification result, which records the scan.
    if (url.pathname.startsWith("/verify/")) {
      return handleVerify(
        request,
        env,
        url,
        url.pathname.slice("/verify".length)
      );
    }

    // Certificate-id scan surface (not Digital Link): verifies directly.
    const head = url.pathname.split("/").filter(Boolean)[0];
    if (head === "cert" || head === "p" || head === "passport") {
      return handleVerify(request, env, url, url.pathname);
    }

    // GS1 Digital Link: a numeric primary key path, or a compressed URI.
    if ((head && /^\d{2,4}$/.test(head)) || looksCompressed(url.pathname)) {
      return handleDigitalLink(request, env, url);
    }

    return json({ error: "not_a_digital_link_path", path: url.pathname }, 404);
  },
};

/** Register a seal. Requires ISSUE_SECRET; refuses outright if unset. */
async function handleIssue(request: Request, env: Env): Promise<Response> {
  if (!env.ISSUE_SECRET) {
    return json(
      { error: "issuing_disabled", detail: "ISSUE_SECRET is not configured." },
      503
    );
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

  // A seal whose GTIN, lot or serial is not valid Digital Link syntax could
  // never be resolved (the resolver answers 400), so refuse it here.
  if (typeof body.gtin === "string") {
    let path = `/01/${encodeURIComponent(body.gtin)}`;
    if (typeof body.lot === "string")
      path += `/10/${encodeURIComponent(body.lot)}`;
    if (typeof body.serial === "string")
      path += `/21/${encodeURIComponent(body.serial)}`;
    const check = parseDigitalLink(new URL(path, env.RESOLVER_ORIGIN));
    if (!check.ok) {
      return json({ error: "invalid_identifier", detail: check.detail }, 400);
    }
  }

  const fields = parseGs1Path(
    typeof body.gtin === "string" ? `/01/${body.gtin}` : `/cert/${certId}`,
    ""
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
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'issued',?13,?14)`
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
        Date.now()
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
    201
  );
}
