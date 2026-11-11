/**
 * /battery-passport/sample — a fictional, Ed25519-signed demonstration
 * LMT e-bike battery passport record.
 *
 * The live AuthiChain issuer private keys are not in this repository and
 * are not on this worker. This sample is signed by a dedicated
 * demonstration Ed25519 key whose public half is bundled with the download.
 * Pinning the record to https://authichain.com/.well-known/jwks.json is
 * expected to report issuer_not_in_jwks. The page recomputes the signature
 * at request time and will not claim "signed" unless WebCrypto agrees.
 *
 * Not a customer record, not an Article 77 passport, not a conformity
 * assessment, not legal advice.
 */
import {
  ESTATE_BASE_CSS,
  ESTATE_FONTS_LINK,
  estateCssVars,
  estateFooter,
  estateNav,
  estateSkipLink,
} from "../../_shared/estate-landing";
import { planById } from "../../../src/lib/plans";
import {
  BATTERY_CHECKOUT_ACTION,
  BATTERY_PASSPORT_DEADLINE,
  BATTERY_PASSPORT_PATH,
  PAGE_DELIVERABLES,
  daysUntilDeadline,
} from "./battery-passport-page";
import { PROTOCOL_JWKS_KEYS } from "./protocol-jwks-route";
import sampleRecordJson from "../../../protocol/samples/battery-passport-demo.record.json";
import sampleJwksJson from "../../../protocol/samples/battery-passport-demo.jwks.json";
import sampleBundleJson from "../../../protocol/samples/battery-passport-demo.bundle.json";

export const SAMPLE_PATH = "/battery-passport/sample";
export const SAMPLE_JSON_PATH = "/battery-passport/sample.json";
export const SAMPLE_RECORD_PATH = "/battery-passport/sample.record.json";
export const SAMPLE_JWKS_PATH = "/battery-passport/sample.jwks.json";
export const SAMPLE_JWS_PATH = "/battery-passport/sample.jws";
export const SAMPLE_CANONICAL = `https://authichain.com${SAMPLE_PATH}`;
export const SAMPLE_LABEL =
  "DEMONSTRATION SAMPLE — FICTIONAL DATA, NOT AN ARTICLE 77 PASSPORT OR LEGAL ADVICE";
export const LIVE_JWKS_URL = "https://authichain.com/.well-known/jwks.json";
export const PROTOCOL_JWKS_URL = "https://authichain.com/protocol/jwks.json";
export const SAMPLE_UTM = {
  utm_source: "site",
  utm_medium: "sample",
  utm_campaign: "battery-passport-sample",
} as const;

/** Same landing-HTML headers as `workers/authichain-com/src/index.ts`. */
const HTML_SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data: https:; frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
};

const SAMPLE_CORS = {
  "Access-Control-Allow-Origin": "*",
} as const;

/** npm 0.1.1 positional form — works today. `--jwks` is not on that release. */
export const NPM_VERIFY_CLI = "npx authichain-verify sample.record.json";
/** Repo CLI until authichain-verify >=0.2.0 is published to npm. */
export const REPO_JWKS_PIN_CLI =
  "node protocol/bin/authichain-verify.mjs --jwks sample.jwks.json sample.record.json";
export const REPO_JWS_CLI =
  "node protocol/bin/authichain-verify.mjs --jwks sample.jwks.json sample.jws";
export const REPO_LIVE_JWKS_CLI =
  "node protocol/bin/authichain-verify.mjs --jwks jwks.json sample.record.json";
export const JWKS_CLI_NOTE =
  "Published authichain-verify@0.1.1 on npm verifies <record.json> [anchor.json]; --jwks pinning and compact JWS checks are on main in protocol/bin/authichain-verify.mjs (unreleased on npm).";

const HTML_PATHS = new Set([SAMPLE_PATH, `${SAMPLE_PATH}/`]);
const ARTIFACT_PATHS = new Set([
  SAMPLE_JSON_PATH,
  `${SAMPLE_JSON_PATH}/`,
  SAMPLE_RECORD_PATH,
  `${SAMPLE_RECORD_PATH}/`,
  SAMPLE_JWKS_PATH,
  `${SAMPLE_JWKS_PATH}/`,
  SAMPLE_JWS_PATH,
  `${SAMPLE_JWS_PATH}/`,
]);

export function isBatteryPassportSamplePath(pathname: string): boolean {
  return HTML_PATHS.has(pathname);
}

export function isBatteryPassportSampleArtifactPath(pathname: string): boolean {
  return ARTIFACT_PATHS.has(pathname);
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!
  );

export type DemoJwk = {
  kty: string;
  crv: string;
  x: string;
  kid: string;
  use?: string;
  alg?: string;
};

export type DemoRecord = {
  "@context": string[];
  type: string[];
  issuer: string;
  validFrom: string;
  validUntil?: string;
  credentialSubject: {
    id: string;
    label: string;
    brand: string;
    name: string;
    model: string;
    serial: string;
    category: string;
    chemistry: string;
    weightKg: number;
    statedEnergyWh: number;
    ratedCapacityAh: number;
    nominalVoltageV: number;
    expectedLifetimeCycles: string;
    manufacturer: string;
    placeOfManufacture: string;
    dateOfManufacture: string;
    statement: string;
    [key: string]: unknown;
  };
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    proofValue: string;
  };
};

export const SAMPLE_RECORD = sampleRecordJson as DemoRecord;
export const SAMPLE_JWKS = sampleJwksJson as { keys: DemoJwk[] };
export const SAMPLE_JWS = String(
  (sampleBundleJson as { jws: string }).jws
).trim();
export const SAMPLE_DEMO_JWK = SAMPLE_JWKS.keys[0]!;

export type SampleVerification = {
  now: string;
  recordSignature: boolean;
  recordIssuerInDemoJwks: boolean;
  recordIssuerInLiveJwks: boolean;
  recordVerdict: "valid-unanchored" | "invalid";
  recordReasons: string[];
  jwsSignature: boolean;
  jwsKidInDemoJwks: boolean;
  jwsVerdict: "valid-offline" | "invalid";
  jwsReasons: string[];
};

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ATTESTATION_TYP = "AC-ATTESTATION+JWS";

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const parts = keys
    .filter(k => record[k] !== undefined)
    .map(k => `${JSON.stringify(k)}:${canonicalize(record[k])}`);
  return `{${parts.join(",")}}`;
}

function signingBytes(record: DemoRecord): Uint8Array {
  const { proof, ...rest } = record;
  const { proofValue: _proofValue, ...proofRest } = proof;
  return new TextEncoder().encode(canonicalize({ ...rest, proof: proofRest }));
}

function base58Decode(str: string): Uint8Array {
  let num = 0n;
  for (const ch of str) {
    const idx = B58.indexOf(ch);
    if (idx === -1) throw new Error(`invalid base58 character: ${ch}`);
    num = num * 58n + BigInt(idx);
  }
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num >>= 8n;
  }
  for (const ch of str) {
    if (ch !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

function fromB64url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error("not base64url");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function publicKeyBytesFromDidKey(did: string): Uint8Array {
  const id = did.split("#")[0]!.replace(/^did:key:/, "");
  if (!id.startsWith("z")) throw new Error("did:key must use base58btc");
  const decoded = base58Decode(id.slice(1));
  if (decoded.length !== 34 || decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error("not an Ed25519 did:key");
  }
  return decoded.subarray(2);
}

function jwkMatchesDid(jwk: DemoJwk, did: string): boolean {
  try {
    if (
      jwk.kty !== "OKP" ||
      jwk.crv !== "Ed25519" ||
      typeof jwk.x !== "string"
    ) {
      return false;
    }
    return bytesEq(fromB64url(jwk.x), publicKeyBytesFromDidKey(did));
  } catch {
    return false;
  }
}

async function importEd25519VerifyKey(x: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    { kty: "OKP", crv: "Ed25519", x },
    { name: "Ed25519" },
    false,
    ["verify"]
  );
}

async function verifyRecordSignature(
  record: DemoRecord,
  jwk: DemoJwk
): Promise<boolean> {
  const sigStr = String(record.proof?.proofValue ?? "");
  if (!sigStr.startsWith("z")) return false;
  try {
    const signature = base58Decode(sigStr.slice(1));
    const key = await importEd25519VerifyKey(jwk.x);
    return crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      signature,
      signingBytes(record)
    );
  } catch {
    return false;
  }
}

async function verifyCompactJws(
  jws: string,
  keys: DemoJwk[],
  now: Date
): Promise<{
  ok: boolean;
  kid: boolean;
  signatureOk: boolean;
  reasons: string[];
}> {
  const reasons: string[] = [];
  const parts = jws.trim().split(".");
  if (parts.length !== 3) {
    return {
      ok: false,
      kid: false,
      signatureOk: false,
      reasons: ["jws_malformed"],
    };
  }
  let header: { alg?: string; typ?: string; kid?: string };
  let payload: {
    expires_at?: string;
    decision?: string;
    status?: string;
  };
  try {
    header = JSON.parse(new TextDecoder().decode(fromB64url(parts[0]!)));
    payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[1]!)));
  } catch {
    return {
      ok: false,
      kid: false,
      signatureOk: false,
      reasons: ["jws_malformed"],
    };
  }
  if (header.alg !== "EdDSA") reasons.push(`alg_unsupported:${header.alg}`);
  if (header.typ !== ATTESTATION_TYP)
    reasons.push(`typ_unexpected:${header.typ}`);
  const jwk =
    typeof header.kid === "string"
      ? keys.find(k => k.kid === header.kid)
      : undefined;
  const kid = Boolean(jwk);
  if (!jwk) {
    reasons.push("kid_not_in_jwks");
    return { ok: false, kid, signatureOk: false, reasons };
  }
  if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || typeof jwk.x !== "string") {
    reasons.push("jwk_not_ed25519");
    return { ok: false, kid, signatureOk: false, reasons };
  }
  let signatureOk = false;
  try {
    const key = await importEd25519VerifyKey(jwk.x);
    signatureOk = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      fromB64url(parts[2]!),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) {
    reasons.push("signature_invalid");
    return { ok: false, kid, signatureOk, reasons };
  }
  if (payload.expires_at !== undefined) {
    const exp = new Date(payload.expires_at);
    if (Number.isNaN(exp.getTime())) reasons.push("expires_at_malformed");
    else if (exp.getTime() <= now.getTime()) reasons.push("expired");
  }
  if (payload.decision !== "verified")
    reasons.push(`decision:${payload.decision}`);
  if (payload.status !== "active") reasons.push(`status:${payload.status}`);
  return { ok: reasons.length === 0, kid, signatureOk, reasons };
}

/** Recomputes Ed25519 checks. Never returns "signed" without a real verify. */
export async function evaluateSampleVerification(
  now: Date = new Date(),
  record: DemoRecord = SAMPLE_RECORD,
  jwks: { keys: DemoJwk[] } = SAMPLE_JWKS,
  jws: string = SAMPLE_JWS
): Promise<SampleVerification> {
  const demoJwk = jwks.keys[0];
  const recordReasons: string[] = [];
  const recordSignature = demoJwk
    ? await verifyRecordSignature(record, demoJwk)
    : false;
  if (!recordSignature) recordReasons.push("signature_invalid");
  const signer = String(
    record.proof?.verificationMethod ?? record.issuer ?? ""
  ).split("#")[0]!;
  const recordIssuerInDemoJwks = jwks.keys.some(k => jwkMatchesDid(k, signer));
  const recordIssuerInLiveJwks = PROTOCOL_JWKS_KEYS.some(k =>
    jwkMatchesDid(k as DemoJwk, signer)
  );
  if (!recordIssuerInDemoJwks) recordReasons.push("issuer_not_in_demo_jwks");
  const validFrom = new Date(record.validFrom);
  if (Number.isNaN(validFrom.getTime()))
    recordReasons.push("validFrom_malformed");
  else if (validFrom.getTime() > now.getTime())
    recordReasons.push("not_yet_valid");
  if (record.validUntil) {
    const validUntil = new Date(record.validUntil);
    if (Number.isNaN(validUntil.getTime()))
      recordReasons.push("validUntil_malformed");
    else if (validUntil.getTime() < now.getTime())
      recordReasons.push("expired");
  }
  const jwsCheck = await verifyCompactJws(jws, jwks.keys, now);
  return {
    now: now.toISOString(),
    recordSignature,
    recordIssuerInDemoJwks,
    recordIssuerInLiveJwks,
    recordVerdict: recordReasons.length ? "invalid" : "valid-unanchored",
    recordReasons,
    jwsSignature: jwsCheck.signatureOk,
    jwsKidInDemoJwks: jwsCheck.kid,
    jwsVerdict: jwsCheck.ok ? "valid-offline" : "invalid",
    jwsReasons: jwsCheck.reasons,
  };
}

export async function buildSampleBundle(now: Date = new Date()) {
  const verification = await evaluateSampleVerification(now);
  return {
    sampleOnly: true,
    signatureStatus: verification.recordSignature
      ? "signed"
      : "signature_invalid",
    label: SAMPLE_LABEL,
    notArticle77: true,
    notLegalAdvice: true,
    notACustomerRecord: true,
    notCertifiedConformityAssessment: true,
    signer: {
      kind: "dedicated_demonstration_ed25519",
      did: SAMPLE_RECORD.issuer,
      kid: SAMPLE_DEMO_JWK.kid,
      verificationMethod: SAMPLE_RECORD.proof.verificationMethod,
      note: "Signed by a dedicated demonstration Ed25519 key generated for this fictional sample. The live AuthiChain issuer private keys are not in this repository and were not used.",
    },
    liveJwks: {
      urls: [LIVE_JWKS_URL, PROTOCOL_JWKS_URL],
      expectedWhenPinned: "issuer_not_in_jwks",
      observed: verification.recordIssuerInLiveJwks
        ? "issuer_in_jwks"
        : "issuer_not_in_jwks",
      reason:
        "This demonstration key is not the live AuthiChain issuer. Pinning the sample to the live JWKS is expected to report issuer_not_in_jwks. Do not add this key to live JWKS.",
    },
    verification: {
      recordVerdict: verification.recordVerdict,
      recordReasons: verification.recordReasons,
      recordSignature: verification.recordSignature,
      recordIssuerInDemoJwks: verification.recordIssuerInDemoJwks,
      recordIssuerInLiveJwks: verification.recordIssuerInLiveJwks,
      jwsVerdict: verification.jwsVerdict,
      jwsReasons: verification.jwsReasons,
      jwsSignature: verification.jwsSignature,
      checkedAt: verification.now,
    },
    offlineVerifier: {
      package: "authichain-verify",
      repoCli:
        "node protocol/verifier.mjs protocol/samples/battery-passport-demo.record.json",
      npmCli: NPM_VERIFY_CLI,
      jwksPinCli: REPO_JWKS_PIN_CLI,
      jwsCli: REPO_JWS_CLI,
      jwksCliNote: JWKS_CLI_NOTE,
      expectedRecordVerdict: "valid-unanchored",
      expectedJwsVerdict: "valid-offline",
    },
    jwks: SAMPLE_JWKS,
    record: SAMPLE_RECORD,
    jws: SAMPLE_JWS,
  };
}

function checkoutForm(id: string, label: string): string {
  const hidden = Object.entries(SAMPLE_UTM)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`)
    .join("");
  return `<form class="checkout-email-form" action="${BATTERY_CHECKOUT_ACTION}" method="post" id="${id}">
  <label class="checkout-email-label" for="${id}-email">Work email
    <input id="${id}-email" name="email" type="email" required maxlength="254" autocomplete="email" inputmode="email" placeholder="you@yourbrand.com">
  </label>
  ${hidden}
  <p class="checkout-email-hint">Opens Stripe checkout. Your email is used for the receipt and workspace activation. Not a newsletter.</p>
  <button class="btn btn-primary" type="submit">${esc(label)}</button>
</form>`;
}

function statusClass(ok: boolean): string {
  return ok ? "ok" : "no";
}

export async function renderBatteryPassportSamplePage(
  now: Date = new Date()
): Promise<string> {
  const plan = planById("dpp_readiness");
  const price = plan?.price ?? 299;
  const days = daysUntilDeadline(now);
  const v = await evaluateSampleVerification(now);
  const subject = SAMPLE_RECORD.credentialSubject;
  const title = `Fictional demonstration battery passport sample | AuthiChain`;
  const description =
    "Ed25519-signed fictional LMT e-bike battery pack. Demonstration sample only — not an Article 77 passport, not a customer record, not legal advice.";
  const deliverables = PAGE_DELIVERABLES.map(f => `<li>${esc(f)}</li>`).join(
    ""
  );
  const recordStatus =
    v.recordVerdict === "valid-unanchored" && v.recordSignature
      ? "valid-unanchored"
      : "invalid";
  const liveJwksStatus = v.recordIssuerInLiveJwks
    ? "issuer_in_jwks"
    : "issuer_not_in_jwks";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Fictional demonstration battery passport sample",
    url: SAMPLE_CANONICAL,
    description,
    isPartOf: { "@type": "WebSite", url: "https://authichain.com" },
    about: {
      "@type": "DigitalDocument",
      name: SAMPLE_LABEL,
      encodingFormat: "application/json",
      url: `https://authichain.com${SAMPLE_JSON_PATH}`,
    },
  };
  const packRows: Array<[string, string]> = [
    ["Brand", String(subject.brand)],
    ["Model", String(subject.model)],
    ["Serial", String(subject.serial)],
    ["Category", String(subject.category)],
    ["Chemistry", String(subject.chemistry)],
    ["Stated energy", `${subject.statedEnergyWh} Wh`],
    ["Capacity", `${subject.ratedCapacityAh} Ah`],
    ["Nominal voltage", `${subject.nominalVoltageV} V`],
    ["Weight", `${subject.weightKg} kg`],
    ["Expected lifetime", String(subject.expectedLifetimeCycles)],
    ["Manufacturer", String(subject.manufacturer)],
    ["Place of manufacture", String(subject.placeOfManufacture)],
    ["Date of manufacture", String(subject.dateOfManufacture)],
  ];
  const packTable = packRows
    .map(([k, val]) => `<tr><th>${esc(k)}</th><td>${esc(val)}</td></tr>`)
    .join("");

  const webcryptoSnippet = `// Browser / Workers WebCrypto. Fetches the sample and checks Ed25519.
const bundle = await (await fetch("https://authichain.com/battery-passport/sample.json")).json();
const record = bundle.record;
const jwk = bundle.jwks.keys[0];
const { proof, ...rest } = record;
const { proofValue, ...proofRest } = proof;
const canonicalize = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  return "{" + Object.keys(value).filter((k) => value[k] !== undefined).sort()
    .map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") + "}";
};
const data = new TextEncoder().encode(canonicalize({ ...rest, proof: proofRest }));
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const b58 = proofValue.slice(1);
let n = 0n;
for (const ch of b58) n = n * 58n + BigInt(B58.indexOf(ch));
const sig = [];
while (n > 0n) { sig.unshift(Number(n & 0xffn)); n >>= 8n; }
for (const ch of b58) { if (ch !== "1") break; sig.unshift(0); }
const key = await crypto.subtle.importKey("jwk", { kty: "OKP", crv: "Ed25519", x: jwk.x }, { name: "Ed25519" }, false, ["verify"]);
console.log(await crypto.subtle.verify({ name: "Ed25519" }, key, Uint8Array.from(sig), data));`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${SAMPLE_CANONICAL}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${SAMPLE_CANONICAL}">
  <meta property="og:image" content="https://authichain.com/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/<\/script/gi, "<\\/script")}</script>
  ${ESTATE_FONTS_LINK}
  <style>
    ${estateCssVars("authichain")}
    ${ESTATE_BASE_CSS}
    .sa-sample { display:inline-block; padding:.35rem .8rem; border:1px dashed var(--border); border-radius:999px; font-size:.85rem; margin-bottom:1rem; }
    .sa-table { width:100%; border-collapse:collapse; margin:.75rem 0; font-size:.92rem; }
    .sa-table th, .sa-table td { text-align:left; padding:.45rem .5rem; border-top:1px solid var(--border); vertical-align:top; }
    .sa-table th { width:12rem; }
    .sa-scroll { overflow-x:auto; }
    .sa-status { font-family:ui-monospace,monospace; font-weight:650; }
    .sa-status.ok { color:#047857; }
    .sa-status.no { color:#b45309; }
    .sa-list { margin:.25rem 0 0 1.2rem; }
    .sa-list li { margin:.5rem 0; line-height:1.6; }
    .bp-note { font-size:.9rem; color: var(--text-dim); }
    pre.sa-code { overflow:auto; padding:1rem; border:1px solid var(--border); border-radius:.75rem; background:var(--bg2); font-size:.82rem; line-height:1.5; }
  </style>
</head>
<body>
  ${estateSkipLink()}
  ${estateNav(
    "authichain",
    [
      { href: BATTERY_PASSPORT_PATH, label: "Battery passport" },
      { href: `${BATTERY_PASSPORT_PATH}/sample-audit`, label: "Walkthrough" },
      { href: "/pricing", label: "Pricing" },
    ],
    { href: "#get-started", label: `Get ready — $${price}` }
  )}
<main id="main">
  <header class="estate-hero hero" id="hero">
    <div class="wrap hero-content">
      <p class="sa-sample">${esc(SAMPLE_LABEL)}</p>
      <h1>A signed fictional LMT e-bike battery pack.</h1>
      <p class="estate-lede hero-sub">This page serves a cryptographically valid Ed25519 demonstration record so you can run AuthiChain's open-source offline verifier. Every figure is fictional. It is not an Article 77 battery passport, not a customer record, and not legal advice.</p>
      <div class="estate-actions hero-cta">
        <a class="btn btn-primary" href="${SAMPLE_JSON_PATH}">Download signed JSON</a>
        <a class="btn btn-outline" href="#verify">Verify offline</a>
        <a class="btn btn-outline" href="${BATTERY_PASSPORT_PATH}">Back to the gap map</a>
      </div>
    </div>
  </header>

  <section class="estate-section" id="limits">
    <div class="wrap">
      <h2>What this is, and is not</h2>
      <p class="section-sub">${days} days until 18 February 2027, when Regulation (EU) 2023/1542 requires a digital battery passport for LMT packs placed on the EU market. This sample does not satisfy that duty.</p>
      <ul class="sa-list">
        <li>It is a <strong>fictional demonstration sample</strong> of how a signed provenance record looks and how you check the signature.</li>
        <li>It is <strong>not</strong> an Article 77 passport, not a notified-body opinion, not a certified EU conformity assessment, and not legal advice.</li>
        <li>It is <strong>not</strong> a customer record. The brand, assembler, city, serial and chemistry are labelled fictional.</li>
        <li>The signature is real Ed25519 over RFC 8785 canonical JSON. The signer is a <strong>dedicated demonstration key</strong>, not the live AuthiChain issuer in <a href="${LIVE_JWKS_URL}"><code>/.well-known/jwks.json</code></a>.</li>
        <li>There is no mainnet anchor on this sample, so the honest offline verdict is <code>valid-unanchored</code>, not <code>verified</code>.</li>
      </ul>
    </div>
  </section>

  <section class="estate-section" id="pack">
    <div class="wrap">
      <h2>Fictional pack figures</h2>
      <p class="section-sub">Public-layer shaped fields for an EXAMPLE LMT e-bike pack. Stated energy is 48 V × 14 Ah = 672 Wh. None of these values belong to a real product.</p>
      <div class="sa-scroll"><table class="sa-table"><tbody>${packTable}</tbody></table></div>
      <p class="bp-note">Confirm obligations against Regulation (EU) 2023/1542 with your counsel. AuthiChain does not operate the EU passport registry. The economic operator placing the battery on the EU market issues the passport.</p>
    </div>
  </section>

  <section class="estate-section" id="status">
    <div class="wrap">
      <h2>Verification status</h2>
      <p class="section-sub">Recomputed on this request with WebCrypto Ed25519. A green row is a check that passed. This table will not say the sample is signed if the signature fails.</p>
      <div class="sa-scroll"><table class="sa-table">
        <tbody>
          <tr><th>Record Ed25519 signature</th><td class="sa-status ${statusClass(v.recordSignature)}">${v.recordSignature ? "valid" : "invalid"}</td></tr>
          <tr><th>Offline record verdict</th><td class="sa-status ${statusClass(recordStatus === "valid-unanchored")}"><code>${esc(recordStatus)}</code></td></tr>
          <tr><th>Signer in bundled demonstration JWKS</th><td class="sa-status ${statusClass(v.recordIssuerInDemoJwks)}">${v.recordIssuerInDemoJwks ? "yes" : "no"}</td></tr>
          <tr><th>Signer in live <code>/.well-known/jwks.json</code></th><td class="sa-status ${statusClass(false)}"><code>${esc(liveJwksStatus)}</code> (expected — demonstration key)</td></tr>
          <tr><th>Compact JWS against demonstration JWKS</th><td class="sa-status ${statusClass(v.jwsVerdict === "valid-offline")}"><code>${esc(v.jwsVerdict)}</code></td></tr>
          <tr><th>Demonstration kid</th><td><code>${esc(SAMPLE_DEMO_JWK.kid)}</code></td></tr>
          <tr><th>Demonstration did:key</th><td><code>${esc(SAMPLE_RECORD.issuer)}</code></td></tr>
          <tr><th>Valid from / until</th><td><code>${esc(SAMPLE_RECORD.validFrom)}</code> → <code>${esc(SAMPLE_RECORD.validUntil ?? "")}</code></td></tr>
        </tbody>
      </table></div>
      <p class="bp-note">JWS <code>decision: "verified"</code> means the demonstration issuer signed this fictional payload. It is not an Article 77 conformity decision. Live issuer kids <code>jWTo5QsZfTVi2oQqsfq9E-aSB2XZ0vrXmfE3h0amEDM</code> and <code>T3AL7c4wZVoXk1IXvpaaHGUmoZHZ3k1mTommJu9wToQ</code> did not sign this sample. No Cloudflare Worker secret or D1 seed is required to serve it.</p>
    </div>
  </section>

  <section class="estate-section" id="download">
    <div class="wrap">
      <h2>Download the signed bundle</h2>
      <ul class="sa-list">
        <li><a href="${SAMPLE_JSON_PATH}"><code>${SAMPLE_JSON_PATH}</code></a> — JSON bundle (record + demonstration JWKS + compact JWS + verification)</li>
        <li><a href="${SAMPLE_RECORD_PATH}"><code>${SAMPLE_RECORD_PATH}</code></a> — Ed25519Signature2020 record only</li>
        <li><a href="${SAMPLE_JWKS_PATH}"><code>${SAMPLE_JWKS_PATH}</code></a> — demonstration public JWKS (not the live issuer)</li>
        <li><a href="${SAMPLE_JWS_PATH}"><code>${SAMPLE_JWS_PATH}</code></a> — compact JWS (<code>typ: AC-ATTESTATION+JWS</code>)</li>
      </ul>
    </div>
  </section>

  <section class="estate-section" id="verify">
    <div class="wrap">
      <h2>Offline CLI verification</h2>
      <p class="section-sub">Same checks as <a href="https://www.npmjs.com/package/authichain-verify"><code>authichain-verify</code></a> (<code>0.1.1</code> on npm verifies the <code>did:key</code> record; <code>--jwks</code> pinning and compact JWS checks are in <code>protocol/bin/authichain-verify.mjs</code> on <code>main</code>, unreleased on npm). Nothing here contacts AuthiChain to decide the signature.</p>
<pre class="sa-code"><code>curl -sO https://authichain.com/battery-passport/sample.record.json
curl -sO https://authichain.com/battery-passport/sample.jwks.json
curl -sO https://authichain.com/battery-passport/sample.jws

# Record carries its signer as did:key. Expected verdict: valid-unanchored
# Live npm authichain-verify@0.1.1 only accepts record.json [anchor.json]
${NPM_VERIFY_CLI}

# --jwks is in protocol/bin/authichain-verify.mjs on main, not on npm 0.1.1 yet:
${REPO_JWKS_PIN_CLI}

# Compact JWS against the demonstration JWKS. Expected verdict: valid-offline
${REPO_JWS_CLI}

# Live AuthiChain JWKS. Expected reason: issuer_not_in_jwks
curl -sO https://authichain.com/.well-known/jwks.json
${REPO_LIVE_JWKS_CLI}</code></pre>
      <p class="bp-note">From this repository: <code>node protocol/verifier.mjs protocol/samples/battery-passport-demo.record.json</code>. Edit any field in the JSON and run it again: the verdict becomes <code>invalid</code> with <code>signature_invalid</code>.</p>
    </div>
  </section>

  <section class="estate-section" id="webcrypto">
    <div class="wrap">
      <h2>WebCrypto verification</h2>
      <p class="section-sub">Ed25519 over the RFC 8785 canonical record minus <code>proof.proofValue</code>. Paste into a browser console on this origin, or any runtime with Ed25519 WebCrypto.</p>
<pre class="sa-code"><code>${esc(webcryptoSnippet)}</code></pre>
    </div>
  </section>

  <section class="estate-cta cta-section" id="get-started">
    <div class="wrap">
      <h2>Open a workspace for your battery line</h2>
      <p class="bp-price">$${price} <span class="bp-note">one-time</span></p>
      <ul class="sa-list">${deliverables}</ul>
      <p class="section-sub">The checkout opens an AuthiChain workspace. It does not issue an Article 77 passport and does not email this sample as a legal document.</p>
      <div class="estate-actions">${checkoutForm("sample-checkout", `Get ready — $${price}`)}</div>
    </div>
  </section>
</main>
${estateFooter(
  "authichain",
  [
    {
      heading: "Start",
      links: [
        { href: BATTERY_PASSPORT_PATH, label: "Battery passport" },
        { href: SAMPLE_PATH, label: "Signed sample" },
        {
          href: `${BATTERY_PASSPORT_PATH}/sample-audit`,
          label: "Fictional walkthrough",
        },
        { href: "/pricing", label: "Pricing" },
      ],
    },
    {
      heading: "Verify",
      links: [
        { href: SAMPLE_JSON_PATH, label: "Sample JSON" },
        { href: "/protocol", label: "Protocol" },
        { href: LIVE_JWKS_URL, label: "Live JWKS" },
      ],
    },
    { heading: "Company", links: [{ href: "/contact", label: "Contact" }] },
  ],
  "AuthiChain is a brand. The SAM legal entity is ZACHARY KIETZMAN. Demonstration sample only. Not an Article 77 passport. Not legal advice."
)}
</body>
</html>`;
}

function jsonResponse(
  body: unknown,
  method: string,
  extra: Record<string, string> = {}
): Response {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
    ...SAMPLE_CORS,
    Allow: "GET, HEAD",
    ...extra,
  };
  if (method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(JSON.stringify(body), { status: 200, headers });
}

export async function tryHandleBatteryPassportSample(
  request: Request
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  const html = isBatteryPassportSamplePath(pathname);
  const artifact = isBatteryPassportSampleArtifactPath(pathname);
  if (!html && !artifact) return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Allow: "GET, HEAD",
      },
    });
  }
  if (html) {
    const page = await renderBatteryPassportSamplePage();
    const headers = {
      ...HTML_SECURITY_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
    };
    if (request.method === "HEAD")
      return new Response(null, { status: 200, headers });
    return new Response(page, { status: 200, headers });
  }
  const path = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (path === SAMPLE_RECORD_PATH)
    return jsonResponse(SAMPLE_RECORD, request.method);
  if (path === SAMPLE_JWKS_PATH)
    return jsonResponse(SAMPLE_JWKS, request.method);
  if (path === SAMPLE_JWS_PATH) {
    const headers = {
      "Content-Type": "application/jose",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      ...SAMPLE_CORS,
      Allow: "GET, HEAD",
    };
    if (request.method === "HEAD")
      return new Response(null, { status: 200, headers });
    return new Response(SAMPLE_JWS + "\n", { status: 200, headers });
  }
  const bundle = await buildSampleBundle();
  return jsonResponse(bundle, request.method);
}
