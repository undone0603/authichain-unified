/**
 * GS1-Conformant Resolver behaviour (Conformant Resolver 1.2): request
 * parsing, link types, linksets and the redirect decision.
 *
 * Kept free of D1 and of the Workers runtime so it can be tested directly.
 * The criteria and the checks this answers come from GS1's own test suite
 * (github.com/gs1/GS1DL-resolver-testsuite, Conformance1_2.txt); see
 * docs/GS1_CONFORMANCE.md for the mapping.
 */
import GS1DigitalLinkToolkit from "./vendor/gs1-dl-toolkit.mjs";

let toolkit: GS1DigitalLinkToolkit | null = null;
function tk(): GS1DigitalLinkToolkit {
  // The toolkit builds large lookup tables in its constructor; build them once
  // per isolate, not once per request.
  if (!toolkit) toolkit = new GS1DigitalLinkToolkit();
  return toolkit;
}

/** Key qualifiers of AI 01, in the order Digital Link syntax requires. */
const GTIN_QUALIFIERS = ["22", "10", "21"] as const;

export type DigitalLink = {
  gtin: string;
  variant?: string;
  lot?: string;
  serial?: string;
  /** Data attributes from the query string (e.g. 17 expiry), as given. */
  attributes: Record<string, string>;
  /** Canonical path: /01/{14-digit gtin} plus qualifiers in syntax order. */
  path: string;
  /** Present when the request URI was compressed. */
  uncompressedUri?: string;
};

export type ParseResult =
  | { ok: true; dl: DigitalLink }
  | { ok: false; status: 400 | 404; error: string; detail?: string };

/** Linear-time trailing-slash strip (see the note in index.ts). */
function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 1 && value.charCodeAt(end - 1) === 47) end--;
  return value.slice(0, end);
}

/** A single path segment that could be a compressed Digital Link. */
export function looksCompressed(pathname: string): boolean {
  return /^\/[A-Za-z0-9_-]{8,}$/.test(stripTrailingSlashes(pathname));
}

/**
 * Parse and syntactically validate a Digital Link request.
 *
 * 400 for anything that is not a valid Digital Link (wrong check digit,
 * unknown or out-of-order qualifier, stray segment); 404 for a valid Digital
 * Link whose primary key this resolver does not serve (anything but 01).
 */
export function parseDigitalLink(url: URL): ParseResult {
  const pathname = stripTrailingSlashes(url.pathname);
  let uri = `${url.origin}${pathname}${url.search}`;
  let uncompressedUri: string | undefined;

  if (looksCompressed(pathname)) {
    let detected = "";
    try {
      detected = tk().analyseURI(`${url.origin}${pathname}`, false).detected;
    } catch {
      detected = "";
    }
    if (
      !/compressed GS1 Digital Link/.test(detected) ||
      /^uncompressed/.test(detected)
    ) {
      return { ok: false, status: 404, error: "not_a_digital_link_path" };
    }
    try {
      const expanded = tk().decompressGS1DigitalLink(
        `${url.origin}${pathname}`,
        false,
        url.origin
      );
      // Keep the request's own query string (linkType etc.) after expansion.
      const extra = url.search.slice(1);
      uri = extra
        ? `${expanded}${expanded.includes("?") ? "&" : "?"}${extra}`
        : expanded;
      uncompressedUri = expanded;
    } catch (err) {
      return {
        ok: false,
        status: 400,
        error: "invalid_compressed_digital_link",
        detail: errText(err),
      };
    }
  }

  let extracted: { GS1: Record<string, string>; other: Record<string, string> };
  try {
    extracted = tk().extractFromGS1digitalLink(uri);
  } catch (err) {
    return {
      ok: false,
      status: 400,
      error: "invalid_digital_link",
      detail: errText(err),
    };
  }

  const gs1 = extracted.GS1;
  const gtin = gs1["01"];
  if (!gtin) {
    return { ok: false, status: 404, error: "unsupported_primary_key" };
  }

  // The toolkit accepts qualifiers in any order; the syntax does not.
  if (!uncompressedUri) {
    const parts = new URL(uri).pathname.split("/").filter(Boolean);
    const qualifiers: string[] = [];
    for (let i = 2; i < parts.length; i += 2) qualifiers.push(parts[i]);
    let last = -1;
    for (const q of qualifiers) {
      const at = (GTIN_QUALIFIERS as readonly string[]).indexOf(q);
      if (at <= last) {
        return {
          ok: false,
          status: 400,
          error: "invalid_digital_link",
          detail: `Key qualifier ${q} is not allowed here; after 01 the order is 22, 10, 21.`,
        };
      }
      last = at;
    }
  }

  const dl: DigitalLink = {
    gtin: gtin.padStart(14, "0"),
    variant: gs1["22"],
    lot: gs1["10"],
    serial: gs1["21"],
    attributes: {},
    path: "",
    uncompressedUri,
  };
  for (const [ai, value] of Object.entries(gs1)) {
    if (!["01", ...GTIN_QUALIFIERS].includes(ai)) dl.attributes[ai] = value;
  }
  dl.path = levelPaths(dl)[0];
  return { ok: true, dl };
}

function errText(err: unknown): string {
  return String(err instanceof Error ? err.message : err).trim();
}

/**
 * The request's path and each level above it, most granular first, ending at
 * /01/{gtin}. Walking up drops the last qualifier each time.
 */
export function levelPaths(
  dl: Pick<DigitalLink, "gtin" | "variant" | "lot" | "serial">
): string[] {
  const segs: string[] = [];
  if (dl.variant) segs.push(`/22/${encodeURIComponent(dl.variant)}`);
  if (dl.lot) segs.push(`/10/${encodeURIComponent(dl.lot)}`);
  if (dl.serial) segs.push(`/21/${encodeURIComponent(dl.serial)}`);
  const base = `/01/${dl.gtin}`;
  const out: string[] = [];
  for (let n = segs.length; n >= 0; n--)
    out.push(base + segs.slice(0, n).join(""));
  return out;
}

/* ------------------------------------------------------------------ links */

/** GS1 Web vocabulary namespace used for link relation types in linksets. */
export const GS1_VOC = "https://ref.gs1.org/voc/";

/**
 * Link types this resolver ever serves. Each is in GS1's ratified list.
 * Advertised in the description file, so keep the two in step.
 */
export const SERVED_LINK_TYPES = ["defaultLink", "certificationInfo"] as const;
export type LinkType = (typeof SERVED_LINK_TYPES)[number];

export type Link = { href: string; title: string; type?: string };

export type Level = {
  /** Absolute anchor URI for this level. */
  anchor: string;
  description?: string;
  links: Partial<Record<LinkType, Link[]>>;
};

/**
 * Normalise a linkType value to the bare GS1 term.
 *
 * Accepts the gs1: CURIE and the https/http gs1.org, www.gs1.org and
 * ref.gs1.org vocabulary URIs. `linkset` and `all` (deprecated) both mean the
 * whole linkset. Returns null for a link type outside the GS1 vocabulary.
 */
export function normalizeLinkType(raw: string): string | null {
  const v = raw.trim();
  if (v === "linkset" || v === "all") return "linkset";
  if (v.startsWith("gs1:")) return v.slice(4) || null;
  const m = /^https?:\/\/(?:www\.|ref\.)?gs1\.org\/voc\/([A-Za-z]+)$/.exec(v);
  return m ? m[1] : null;
}

/** Links of one type, from the most granular level that has any. */
export function findLinks(levels: Level[], term: string): Link[] | null {
  for (const level of levels) {
    const links = level.links[term as LinkType];
    if (links && links.length) return links;
  }
  return null;
}

/** RFC 9264 linkset. Link relation types are full GS1 vocabulary URIs. */
export function toLinkset(levels: Level[]) {
  return {
    linkset: levels
      .filter(l => Object.values(l.links).some(v => v && v.length))
      .map(l => {
        const entry: Record<string, unknown> = { anchor: l.anchor };
        if (l.description) entry.description = l.description;
        for (const [term, links] of Object.entries(l.links)) {
          if (links && links.length) entry[`${GS1_VOC}${term}`] = links;
        }
        return entry;
      }),
  };
}

/** Where the JSON-LD context for GS1 linksets is published. */
export const LINKSET_CONTEXT =
  "https://gs1.github.io/linkset/linksetContext.jsonld";

export function wantsLinkset(request: Request, url: URL): boolean {
  const lt = url.searchParams.get("linkType");
  if (lt !== null && normalizeLinkType(lt) === "linkset") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("application/linkset+json");
}

/**
 * Append the request's query string to a redirect target, as the standard
 * requires by default ("pass on all key=value pairs").
 */
export function withQuery(href: string, search: string): string {
  if (!search || search === "?") return href;
  const qs = search.startsWith("?") ? search.slice(1) : search;
  return `${href}${href.includes("?") ? "&" : "?"}${qs}`;
}
