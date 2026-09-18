import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { importPKCS8 } from "jose";
import QRCode from "qrcode";
import {
  signAttestation,
  verifyAttestationJws,
  getKeyId,
} from "../packages/verifier/src/index";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRIVATE_KEY_B64 = process.env.AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64;
const EXPLICIT_KID = process.env.AUTHICHAIN_ATTESTATION_KEY_ID || "";
const GIT_SHA = process.env.GITHUB_SHA || "unknown";
const RUN_ID = process.env.GITHUB_RUN_ID || "unknown";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}
if (!PRIVATE_KEY_B64) {
  throw new Error("AUTHICHAIN_ATTESTATION_PRIVATE_KEY_B64 is required");
}

const productId = "00000000-0000-4000-8000-000000000001";
const qrCodeId = "00000000-0000-4000-8000-000000000002";
const eventId = "00000000-0000-4000-8000-000000000003";
const objectId = "authi:launch-proof:2026-09-18";
const attestationId = "ac_launch_proof_2026_09_18";
const qronId = "qron-launch-proof-2026-09-18";
const serial = "AC-LAUNCH-001";
const issuedAt = "2026-09-18T00:00:00.000Z";
const storyUrl = `https://authichain.com/story/${productId}`;
const jwksUrl = "https://authichain.com/.well-known/jwks.json";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function supabaseUpsert(table: string, rows: Record<string, unknown>[]) {
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
    throw new Error(`${table} upsert failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function verifyExpectedFailure(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch {
    return;
  }
  throw new Error(`${label} unexpectedly verified`);
}

const privateKey = await importPKCS8(
  Buffer.from(PRIVATE_KEY_B64, "base64").toString("utf8"),
  "EdDSA",
);
const keyId = EXPLICIT_KID || (await getKeyId(privateKey));

const baseAttestation = {
  version: "0.1" as const,
  attestation_id: attestationId,
  issuer: { id: "https://authichain.com", name: "AuthiChain" },
  subject: {
    object_id: objectId,
    product_class: "generic-provenance",
    gtin: "00012345678905",
    serial,
    lot: "LAUNCH-PROOF",
  },
  decision: "verified" as const,
  status: "active" as const,
  issued_at: issuedAt,
  evidence: [
    {
      id: "ev_launch_object",
      type: "registry-record",
      digest: `sha256:${sha256(`${objectId}|${serial}|qron|${qronId}`)}`,
      uri: storyUrl,
    },
  ],
};

const jws = await signAttestation(baseAttestation, privateKey, keyId);

const jwksResponse = await fetch(jwksUrl, {
  headers: { accept: "application/json" },
});
if (!jwksResponse.ok) {
  throw new Error(`JWKS endpoint returned HTTP ${jwksResponse.status}`);
}
const liveJwks = await jwksResponse.json();
const publicJwk = liveJwks.keys?.find((key: any) => key.kid === keyId);
if (!publicJwk) throw new Error(`live JWKS does not expose kid ${keyId}`);

await verifyAttestationJws(jws, publicJwk, { expectedObjectId: objectId });

const alteredPayload = jws.split(".");
const payload = JSON.parse(
  Buffer.from(alteredPayload[1], "base64url").toString("utf8"),
);
payload.subject.object_id = "authi:altered-subject";
alteredPayload[1] = Buffer.from(JSON.stringify(payload)).toString("base64url");
await verifyExpectedFailure("altered payload", () =>
  verifyAttestationJws(alteredPayload.join("."), publicJwk, {
    expectedObjectId: objectId,
  }),
);

const alteredSignature = jws.split(".");
alteredSignature[2] =
  alteredSignature[2].slice(0, -1) +
  (alteredSignature[2].endsWith("A") ? "B" : "A");
await verifyExpectedFailure("altered signature", () =>
  verifyAttestationJws(alteredSignature.join("."), publicJwk, {
    expectedObjectId: objectId,
  }),
);

const wrongSubject = {
  ...baseAttestation,
  subject: { ...baseAttestation.subject, object_id: "authi:wrong-subject" },
};
const wrongSubjectJws = await signAttestation(wrongSubject, privateKey, keyId);
await verifyExpectedFailure("wrong subject", () =>
  verifyAttestationJws(wrongSubjectJws, publicJwk, {
    expectedObjectId: objectId,
  }),
);

const revokedJws = await signAttestation(
  { ...baseAttestation, status: "revoked" },
  privateKey,
  keyId,
);
await verifyExpectedFailure("revoked attestation", () =>
  verifyAttestationJws(revokedJws, publicJwk, { expectedObjectId: objectId }),
);

const staleJws = await signAttestation(
  {
    ...baseAttestation,
    issued_at: "2024-01-01T00:00:00.000Z",
    expires_at: "2024-01-02T00:00:00.000Z",
  },
  privateKey,
  keyId,
);
await verifyExpectedFailure("stale attestation", () =>
  verifyAttestationJws(staleJws, publicJwk, {
    expectedObjectId: objectId,
    now: Date.parse("2024-01-03T00:00:00.000Z"),
  }),
);

const seed = sha256(`QRON|${objectId}|${serial}`);
const launchProof = {
  objectId,
  attestationId,
  kid: keyId,
  jws,
  jwksUrl,
  qronId,
  qronSeed: seed,
  storyUrl,
  verifiedAt: new Date().toISOString(),
  gitSha: GIT_SHA,
  workflowRunId: RUN_ID,
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
      title: "Birth",
      content:
        "A deterministic product identity is bound to a provider-scoped AuthiChain object and a QRON seed.",
    },
    {
      title: "Proof",
      content:
        "The object is covered by an Ed25519 AuthiChain Attestation Contract v0.1 whose kid resolves through the live public JWKS.",
    },
    {
      title: "Reveal",
      content:
        "Scanning the QRON launch code opens this StoryMode page, which independently checks the signed attestation before presenting the provenance narrative.",
    },
  ],
};

await supabaseUpsert("products", [
  {
    id: productId,
    name: "AuthiChain Launch Proof — QRON / StoryMode",
    brand: "AuthiChain",
    description: "Deterministic production reference object for the AuthiChain cryptographic truth layer.",
    category: "authentication",
    serial_number: serial,
    status: "active",
    data_origin: "launch-proof",
    created_at: issuedAt,
    updated_at: issuedAt,
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
        attestation_id: attestationId,
        kid: keyId,
        jwks_url: jwksUrl,
      },
    },
  },
]);

await supabaseUpsert("certification_events", [
  {
    id: eventId,
    event_type: "launch_proof_created",
    created_at: issuedAt,
    payload: {
      product_id: productId,
      object_id: objectId,
      qron_id: qronId,
      attestation_id: attestationId,
      kid: keyId,
      storymode_url: storyUrl,
      cryptographic_verification: "verified",
      tamper_tests: launchProof.tamperTests,
    },
    notes: "Deterministic AuthiChain production launch proof. This is a provenance event, not a physical scan.",
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
    serial,
    qronId,
    storyUrl,
  },
  cryptography: {
    contract: "AuthiChain Attestation Contract v0.1",
    alg: "EdDSA",
    kid: keyId,
    jwksUrl,
    jwksResolved: true,
    independentVerification: "passed",
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
