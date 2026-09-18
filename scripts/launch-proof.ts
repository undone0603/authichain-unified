import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { generateKeyPair, exportJWK, importPKCS8 } from "jose";
import QRCode from "qrcode";
import {
  parseJws,
  signAttestation,
  verifyAttestationJws,
  type AuthiChainAttestationV01,
} from "../packages/verifier/src/index";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GIT_SHA = process.env.GITHUB_SHA || "unknown";
const RUN_ID = process.env.GITHUB_RUN_ID || "unknown";
const CONFIGURED_KID = process.env.AUTHICHAIN_ATTESTATION_KEY_ID?.trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const productId = "00000000-0000-4000-8000-000000000001";
const qrCodeId = "00000000-0000-4000-8000-000000000002";
const eventId = "00000000-0000-4000-8000-000000000003";
const qronId = "qron-launch-proof-2026-09-18";
const storyUrl = `https://authichain.com/story/${productId}`;
const jwksUrl = "https://authichain.com/protocol/jwks.json";
const fixtureJws = (
  await readFile("fixtures/attestation-v0.1-valid.jws", "utf8")
).trim();

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function pemFromSecret(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("BEGIN PRIVATE KEY")) return trimmed;
  try {
    const decoded = Buffer.from(trimmed.replace(/\s+/g, ""), "base64").toString(
      "utf8",
    );
    if (decoded.includes("BEGIN PRIVATE KEY")) return decoded.trim();
  } catch {
    /* not utf8 PEM */
  }
  const der = trimmed.replace(/\s+/g, "");
  const wrapped = der.match(/.{1,64}/g)?.join("\n") ?? der;
  return `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;
}

async function loadProductionPrivateKey() {
  const raw = process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64;
  if (!raw?.trim()) return null;
  return importPKCS8(pemFromSecret(raw), "EdDSA");
}

async function supabaseUpsert(
  table: string,
  rows: Record<string, unknown>[],
) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=id`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    throw new Error(
      `${table} upsert failed: ${response.status} ${await response.text()}`,
    );
  }
  return response.json();
}

async function verifyExpectedFailure(
  label: string,
  fn: () => Promise<unknown>,
) {
  try {
    await fn();
  } catch {
    return;
  }
  throw new Error(`${label} unexpectedly verified`);
}

const fixture = parseJws(fixtureJws);
const fixturePayload = fixture.payload as {
  attestation_id: string;
  issuer: { id: string; name: string };
  subject: {
    object_id: string;
    gtin?: string;
    serial?: string;
  };
  decision: "verified" | "warning" | "blocked";
  status: "active" | "revoked" | "unknown";
  issued_at: string;
  expires_at?: string;
  evidence: AuthiChainAttestationV01["evidence"];
};

const fixtureKid = String(fixture.protected.kid || "");
if (!fixtureKid) throw new Error("fixture JWS does not contain kid");

const jwksResponse = await fetch(jwksUrl, {
  headers: { accept: "application/json", "cache-control": "no-cache" },
});
if (!jwksResponse.ok) {
  throw new Error(`JWKS endpoint returned HTTP ${jwksResponse.status}`);
}
const liveJwks = (await jwksResponse.json()) as {
  keys?: Array<Record<string, unknown>>;
};
const liveKeys = liveJwks.keys || [];
if (liveKeys.length === 0) {
  throw new Error("live JWKS published zero keys");
}

if (
  CONFIGURED_KID &&
  !liveKeys.some((key) => key.kid === CONFIGURED_KID)
) {
  throw new Error(
    `AUTHICHAIN_ATTESTATION_KEY_ID=${CONFIGURED_KID} is not in live JWKS; live keys=${JSON.stringify(
      liveKeys.map((key) => ({ kid: key.kid, alg: key.alg, crv: key.crv })),
    )}`,
  );
}

const liveKey =
  liveKeys.find((key) => key.kid === CONFIGURED_KID) || liveKeys[0];
const liveKid = String(liveKey.kid || "");
if (!liveKid) throw new Error("live JWKS key is missing kid");

const productionKey = await loadProductionPrivateKey();
let productionJws: string;
let source: string;

if (productionKey) {
  const launchAttestation: AuthiChainAttestationV01 = {
    version: "0.1",
    attestation_id: `urn:authichain:attestation:v01:launch-${RUN_ID}`,
    issuer: fixturePayload.issuer,
    subject: {
      object_id: fixturePayload.subject.object_id,
      gtin: fixturePayload.subject.gtin,
      serial: fixturePayload.subject.serial,
    },
    decision: "verified",
    status: "active",
    issued_at: new Date().toISOString(),
    expires_at: "2027-12-31T00:00:00Z",
    evidence: fixturePayload.evidence?.length
      ? fixturePayload.evidence
      : [
          {
            id: "launch-proof",
            type: "production-launch",
            digest: `sha256:${sha256(fixturePayload.subject.object_id)}`,
          },
        ],
  };
  productionJws = await signAttestation(
    launchAttestation,
    productionKey,
    liveKid,
  );
  source = "production-signed against live JWKS";
} else if (fixtureKid === liveKid) {
  productionJws = fixtureJws;
  source = "fixtures/attestation-v0.1-valid.jws; verified against live JWKS";
} else {
  throw new Error(
    `Cannot bind launch proof: fixture kid ${fixtureKid} != live kid ${liveKid}. Set AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 so CI can sign with the production key (AUTHICHAIN_ATTESTATION_KEY_ID=${CONFIGURED_KID || "unset"}).`,
  );
}

const publicJwk = liveKeys.find((key) => key.kid === liveKid);
if (!publicJwk) {
  throw new Error(`live JWKS does not expose kid ${liveKid}`);
}

const verifiedFixture = await verifyAttestationJws(productionJws, publicJwk, {
  expectedObjectId: fixturePayload.subject.object_id,
});

const alteredPayload = productionJws.split(".");
const payload = JSON.parse(
  Buffer.from(alteredPayload[1], "base64url").toString("utf8"),
);
payload.subject.object_id = "authi:altered-subject";
alteredPayload[1] = Buffer.from(JSON.stringify(payload)).toString("base64url");
await verifyExpectedFailure("altered payload", () =>
  verifyAttestationJws(alteredPayload.join("."), publicJwk, {
    expectedObjectId: fixturePayload.subject.object_id,
  }),
);

const alteredSignature = productionJws.split(".");
alteredSignature[2] =
  alteredSignature[2].slice(0, -1) +
  (alteredSignature[2].endsWith("A") ? "B" : "A");
await verifyExpectedFailure("altered signature", () =>
  verifyAttestationJws(alteredSignature.join("."), publicJwk, {
    expectedObjectId: fixturePayload.subject.object_id,
  }),
);

await verifyExpectedFailure("wrong subject", () =>
  verifyAttestationJws(productionJws, publicJwk, {
    expectedObjectId: "authi:wrong-subject",
  }),
);

const { privateKey: testKey } = await generateKeyPair("Ed25519");
const testPublicJwk = await exportJWK(testKey);
testPublicJwk.kid = "proof-negative-kid";

const revokedJws = await signAttestation(
  {
    version: "0.1",
    attestation_id: "ac_negative_revoked",
    issuer: { id: "https://authichain.com", name: "AuthiChain" },
    subject: { object_id: fixturePayload.subject.object_id },
    decision: "verified",
    status: "revoked",
    issued_at: "2026-08-20T16:00:00Z",
    evidence: [
      {
        id: "negative",
        type: "negative-test",
        digest: `sha256:${"0".repeat(64)}`,
      },
    ],
  },
  testKey,
  "proof-negative-kid",
);
await verifyExpectedFailure("revoked attestation", () =>
  verifyAttestationJws(revokedJws, testPublicJwk, {
    expectedObjectId: fixturePayload.subject.object_id,
  }),
);

const staleJws = await signAttestation(
  {
    version: "0.1",
    attestation_id: "ac_negative_stale",
    issuer: { id: "https://authichain.com", name: "AuthiChain" },
    subject: { object_id: fixturePayload.subject.object_id },
    decision: "verified",
    status: "active",
    issued_at: "2024-01-01T00:00:00.000Z",
    expires_at: "2024-01-02T00:00:00.000Z",
    evidence: [
      {
        id: "negative",
        type: "negative-test",
        digest: `sha256:${"1".repeat(64)}`,
      },
    ],
  },
  testKey,
  "proof-negative-kid",
);
await verifyExpectedFailure("stale attestation", () =>
  verifyAttestationJws(staleJws, testPublicJwk, {
    expectedObjectId: fixturePayload.subject.object_id,
    now: Date.parse("2024-01-03T00:00:00.000Z"),
  }),
);

const objectId = fixturePayload.subject.object_id;
const serial = fixturePayload.subject.serial || "SN-001";
const seed = sha256(`QRON|${objectId}|${serial}|${liveKid}`);
const launchProof = {
  objectId,
  sourceObjectId: fixturePayload.subject.object_id,
  attestationId: verifiedFixture.attestation_id,
  kid: liveKid,
  jws: productionJws,
  jwksUrl,
  qronId,
  qronSeed: seed,
  storyUrl,
  verifiedAt: new Date().toISOString(),
  gitSha: GIT_SHA,
  workflowRunId: RUN_ID,
  source,
  tamperTests: {
    alteredPayload: "rejected",
    alteredSignature: "rejected",
    wrongSubject: "rejected",
    revokedAttestation: "rejected",
    staleAttestation: "rejected",
  },
};

const storymode = {
  title: "The AuthiChain Reference Object",
  chapters: [
    {
      title: "Identity",
      content:
        "A deterministic QRON reference resolves to an AuthiChain object backed by a signed v0.1 attestation.",
    },
    {
      title: "Proof",
      content:
        "The production attestation is independently verified against the live public JWKS using its kid.",
    },
    {
      title: "Reveal",
      content:
        "Scanning the QRON launch code opens StoryMode, where the signed attestation is checked before the provenance narrative is presented.",
    },
  ],
};

await supabaseUpsert("products", [
  {
    id: productId,
    name: "AuthiChain Launch Proof — QRON / StoryMode",
    brand: "AuthiChain",
    description:
      "Deterministic production reference object for the AuthiChain cryptographic truth layer.",
    category: "authentication",
    serial_number: serial,
    status: "active",
    data_origin: "launch-proof",
    updated_at: new Date().toISOString(),
    metadata: {
      launchProof,
      storymode,
    },
  },
]);

await supabaseUpsert("qr_codes", [
  {
    id: qrCodeId,
    product_id: productId,
    name: "QRON Launch Proof 2026-09-18",
    data: storyUrl,
    qrData: storyUrl,
    mode: "qron-launch-proof",
    short_code: "QRON-LAUNCH-2026-09-18",
    metadata: {
      qron: {
        id: qronId,
        seed,
        object_id: objectId,
        attestation_id: verifiedFixture.attestation_id,
        kid: liveKid,
        jwks_url: jwksUrl,
      },
    },
  },
]);

await supabaseUpsert("certification_events", [
  {
    id: eventId,
    event_type: "launch_proof_created",
    created_at: new Date().toISOString(),
    payload: {
      product_id: productId,
      object_id: objectId,
      qron_id: qronId,
      attestation_id: verifiedFixture.attestation_id,
      kid: liveKid,
      storymode_url: storyUrl,
      cryptographic_verification: "verified",
      tamper_tests: launchProof.tamperTests,
    },
    notes:
      "Deterministic AuthiChain production launch proof. This is a provenance event, not a physical scan.",
  },
]);

await mkdir("artifacts", { recursive: true });
const qrPng = await QRCode.toDataURL(storyUrl, {
  errorCorrectionLevel: "H",
  margin: 2,
  width: 1024,
});
await writeFile(
  "artifacts/launch-proof-qron.png",
  Buffer.from(qrPng.split(",")[1], "base64"),
);

const report = {
  type: "authichain.production-launch-proof",
  generatedAt: new Date().toISOString(),
  gitSha: GIT_SHA,
  workflowRunId: RUN_ID,
  referenceObject: {
    productId,
    objectId,
    sourceObjectId: fixturePayload.subject.object_id,
    serial,
    qronId,
    storyUrl,
  },
  cryptography: {
    contract: "AuthiChain Attestation Contract v0.1",
    alg: String(fixture.protected.alg),
    kid: liveKid,
    configuredKid: CONFIGURED_KID || null,
    jwksUrl,
    liveJwksResolved: true,
    independentVerification: "passed",
    productionSigned: Boolean(productionKey),
    source,
  },
  tamperTests: launchProof.tamperTests,
  provenance: {
    eventId,
    eventType: "launch_proof_created",
    physicalScan: false,
  },
  storyMode: {
    url: storyUrl,
    narrative: "bound",
    liveJwksVerification: "passed",
  },
  qron: {
    id: qronId,
    seed,
    qrArtifact: "artifacts/launch-proof-qron.png",
  },
};

await writeFile(
  "artifacts/production-launch-proof.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
