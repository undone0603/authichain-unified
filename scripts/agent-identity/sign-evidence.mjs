/**
 * AgentZ-signed evidence records.
 *
 *   KEY_DIR=/path/outside/repo node scripts/agent-identity/sign-evidence.mjs \
 *     --evidence report.json [--subject urn:...] [--summary "..."] [--out report.json.agentz.json]
 *   node scripts/agent-identity/sign-evidence.mjs --verify report.json.agentz.json --evidence report.json
 *
 * Wraps any evidence file in a protocol record (SPEC §3: W3C VC, Ed25519 over
 * JCS-canonical JSON) issued by AgentZ's published did:key, with the file's
 * SHA-256 in credentialSubject.evidence. Anyone can check it offline with
 * protocol/verifier.mjs, then re-hash the file.
 *
 * The key is KEY_DIR/agentz.ed25519.pem, the one generate.mjs created for the
 * published AgentZ identity. This script never creates a key: a new key would
 * be a different did:key, so its signature would prove nothing. It refuses to
 * sign unless the key matches the published AgentZ did:key.
 *
 * A signature proves AgentZ produced this exact file at this time. It does not
 * make the claims inside the file true; the record says so.
 */
import { createHash, createPrivateKey, createPublicKey, sign as edSign } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { signingBytes, verifyRecord } from '../../protocol/verifier.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const IDENTITIES = join(HERE, '../../workers/authichain-com/src/bot-identities.ts');
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58(buf) {
  let n = BigInt('0x' + (Buffer.from(buf).toString('hex') || '0'));
  let o = '';
  while (n > 0n) { o = B58[Number(n % 58n)] + o; n /= 58n; }
  for (const b of buf) { if (b !== 0) break; o = '1' + o; }
  return o;
}

/** The published AgentZ identity (public material only). */
export function publishedAgentz(file = IDENTITIES) {
  const src = readFileSync(file, 'utf8');
  const json = src.slice(src.indexOf('=') + 1, src.lastIndexOf(';'));
  const agentz = JSON.parse(json).bots.find((b) => b.slug === 'agentz');
  if (!agentz) throw new Error('agentz identity not found in bot-identities.ts');
  return { didKey: agentz.didKey, did: agentz.did, validUntil: agentz.record.validUntil };
}

function loadExistingKey(keyDir) {
  const p = join(keyDir, 'agentz.ed25519.pem');
  if (!existsSync(p)) {
    throw new Error(`no AgentZ key at ${p}; this script never creates one (see generate.mjs)`);
  }
  const privateKey = createPrivateKey(readFileSync(p));
  const raw = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(-32);
  const multibase = 'z' + b58(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
  return { privateKey, multibase, didKey: `did:key:${multibase}` };
}

export function sha256File(path) {
  const bytes = readFileSync(path);
  return { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
}

export function signEvidence({
  keyDir,
  evidencePath,
  subject,
  summary = '',
  now = new Date(),
  validDays = 365,
  expected = publishedAgentz(),
}) {
  const key = loadExistingKey(keyDir);
  if (key.didKey !== expected.didKey) {
    throw new Error(`key in ${keyDir} is ${key.didKey}, not the published AgentZ ${expected.didKey}`);
  }
  const { sha256, bytes } = sha256File(evidencePath);
  const validFrom = new Date(Math.floor(now.getTime() / 1000) * 1000).toISOString();
  const capped = Math.min(now.getTime() + validDays * 86_400_000, new Date(expected.validUntil).getTime());
  const unsigned = {
    '@context': ['https://www.w3.org/ns/credentials/v2', 'https://authichain.com/protocol/v1'],
    type: ['VerifiableCredential', 'AgentZEvidenceRecord'],
    issuer: key.didKey,
    validFrom,
    validUntil: new Date(capped).toISOString(),
    credentialSubject: {
      id: subject || `urn:sha256:${sha256}`,
      agent: expected.did,
      evidence: { file: basename(evidencePath), sha256, bytes },
      summary,
      statement:
        'AgentZ produced this evidence file with exactly these bytes at validFrom. The signature does not certify that the claims inside the file are true.',
    },
  };
  const proofBase = {
    type: 'Ed25519Signature2020',
    created: validFrom,
    verificationMethod: `${key.didKey}#${key.multibase}`,
    proofPurpose: 'assertionMethod',
  };
  const withProof = { ...unsigned, proof: proofBase };
  const sig = edSign(null, signingBytes(withProof), key.privateKey);
  const record = { ...unsigned, proof: { ...proofBase, proofValue: 'z' + b58(sig) } };
  const check = verifyRecord(record, null, { now });
  if (check.verdict !== 'valid-unanchored') {
    throw new Error(`self-check failed: ${check.reasons.join(', ')}`);
  }
  return record;
}

/** Signature, validity, issuer and file digest, all checked. */
export function verifyEvidence(record, evidencePath, { expected = publishedAgentz(), now } = {}) {
  const sig = verifyRecord(record, null, now ? { now } : {});
  const reasons = [...sig.reasons];
  if (record?.issuer !== expected.didKey) reasons.push('issuer_not_agentz');
  if (!(record?.type || []).includes('AgentZEvidenceRecord')) reasons.push('not_an_agentz_evidence_record');
  const { sha256 } = sha256File(evidencePath);
  if (record?.credentialSubject?.evidence?.sha256 !== sha256) reasons.push('evidence_digest_mismatch');
  return { valid: reasons.length === 0 && sig.verdict === 'valid-unanchored', verdict: sig.verdict, reasons };
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const evidencePath = arg('evidence');
  if (!evidencePath) { console.error('--evidence <file> is required'); process.exit(2); }
  const toVerify = arg('verify');
  if (toVerify) {
    const result = verifyEvidence(JSON.parse(readFileSync(toVerify, 'utf8')), evidencePath);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.valid ? 0 : 1);
  }
  const keyDir = process.env.KEY_DIR;
  if (!keyDir) { console.error('KEY_DIR is required (the directory holding agentz.ed25519.pem)'); process.exit(2); }
  const record = signEvidence({ keyDir, evidencePath, subject: arg('subject'), summary: arg('summary') ?? '' });
  const out = arg('out') ?? `${evidencePath}.agentz.json`;
  writeFileSync(out, JSON.stringify(record, null, 2) + '\n');
  console.log(`signed ${basename(evidencePath)} as ${record.issuer} -> ${out}`);
}
