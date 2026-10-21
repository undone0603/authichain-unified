import { generateKeyPairSync, randomBytes, sign as edSign } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function b58encode(buf) {
  let n = BigInt("0x" + (Buffer.from(buf).toString("hex") || "0"));
  let out = "";
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
  for (const b of buf) { if (b !== 0) break; out = "1" + out; }
  return out;
}

function jcs(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(jcs).join(",")}]`;
  return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${jcs(v[k])}`).join(",")}}`;
}

function signingBytes(record) {
  const { proof, ...rest } = record;
  const { proofValue, ...proofRest } = proof ?? {};
  return Buffer.from(jcs({ ...rest, proof: proofRest }), "utf8");
}

function newKey() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const did = "did:key:z" + b58encode(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
  return { privateKey, did };
}

async function main() {
  const key = newKey();
  const now = new Date();
  const tag = `DOGFOOD-${randomBytes(4).toString("hex").toUpperCase()}`;
  
  const rec = {
    "@context": ["https://www.w3.org/ns/credentials/v2", "https://authichain.com/protocol/v1"],
    type: ["VerifiableCredential", "ProvenanceRecord"],
    issuer: key.did,
    validFrom: new Date(now.getTime() - 3600000).toISOString(),
    credentialSubject: {
      id: `https://id.gs1.org/01/09506000134352/21/${tag}`,
      gtin: "09506000134352",
      serial: tag,
      name: "AuthiChain Reference Demonstration"
    },
    proof: {
      type: "Ed25519Signature2020",
      created: now.toISOString(),
      verificationMethod: `${key.did}#key-1`,
      proofPurpose: "assertionMethod",
    },
  };
  
  rec.proof.proofValue = "z" + b58encode(edSign(null, signingBytes(rec), key.privateKey));
  
  const verifierUrl = pathToFileURL(join(ROOT, "protocol", "verifier.mjs")).href;
  const verifier = await import(verifierUrl);
  const verdict = verifier.verifyRecord(rec, null, { now: now.toISOString() });
  
  const outDir = join(ROOT, "docs", "execution");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "AUTHICHAIN_DOGFOOD_RECORD.json");
  
  writeFileSync(outFile, JSON.stringify({ record: rec, verification: verdict }, null, 2));
  console.log("Wrote dogfood record to", outFile);
}

main().catch(console.error);