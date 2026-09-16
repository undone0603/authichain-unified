/**
 * Edge façade: wrap an AuthiChain provenance record in ISO 20022 pacs.008.
 * Offline shape only. Not a bank. Not a Quantum Financial System node.
 */
const PROFILE = 'authichain-qfs-iso20022-v1';
const ISO = 'pacs.008.001.08';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    },
  });
}

async function hexDigest(algo, bytes) {
  const buf = await crypto.subtle.digest(algo, bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function uetrFromSha256(hex) {
  const h = hex.replace(/^sha256:/, '').padEnd(32, '0').slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const keys = Object.keys(value).sort();
  const parts = keys
    .filter((k) => value[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`);
  return `{${parts.join(',')}}`;
}

function signingBytes(record) {
  const { proof, ...rest } = record;
  const { proofValue, ...proofRest } = proof ?? {};
  return new TextEncoder().encode(canonicalize({ ...rest, proof: proofRest }));
}

async function toPacs008(record) {
  const bytes = signingBytes(record);
  const sha256 = await hexDigest('SHA-256', bytes);
  const sha512 = await hexDigest('SHA-512', bytes);
  const digest = {
    sha256: `sha256:${sha256}`,
    sha512: `sha512:${sha512}`,
    pqcAlg: 'ML-DSA-65',
    pqcStatus: 'reserved',
  };
  const sub = record.credentialSubject || {};
  const msgId = `AC-${sha256.slice(0, 16)}`;
  const now = new Date().toISOString();
  return {
    profile: PROFILE,
    ISO20022: ISO,
    Document: {
      FIToFICstmrCdtTrf: {
        GrpHdr: {
          MsgId: msgId,
          CreDtTm: now,
          NbOfTxs: '1',
          CtrlSum: '0',
          SttlmInf: { SttlmMtd: 'CLRG' },
        },
        CdtTrfTxInf: {
          PmtId: {
            InstrId: msgId,
            EndToEndId: String(sub.serial || sub.gtin || sub.id || msgId),
            UETR: uetrFromSha256(sha256),
          },
          IntrBkSttlmAmt: { Ccy: 'USD', _: '0' },
          ChrgBr: 'SLEV',
          Dbtr: {
            Nm: 'AuthiChain issuer',
            Id: { OrgId: { Othr: { Id: record.issuer, SchmeNm: { Prtry: 'DID' } } } },
          },
          Cdtr: {
            Nm: 'Bearer of item',
            Id: {
              OrgId: {
                Othr: { Id: String(sub.id || ''), SchmeNm: { Prtry: 'GS1-DIGITAL-LINK' } },
              },
            },
          },
          RmtInf: { Ustrd: `AuthiChain provenance ${sub.gtin || ''} ${sub.serial || ''}`.trim() },
          SplmtryData: {
            Envlp: { AuthiChain: { profile: PROFILE, record, digest, gtin: sub.gtin || null, serial: sub.serial || null } },
          },
        },
      },
    },
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
      });
    }
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return json({
        service: 'authichain-qfs-adapter',
        profile: PROFILE,
        iso20022: ISO,
        pqc: { alg: 'ML-DSA-65', status: 'reserved' },
        note: 'ISO 20022 carriage for AuthiChain records. Not a Quantum Financial System node.',
      });
    }
    if (request.method === 'POST' && url.pathname === '/envelope') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'invalid-json' }, 400);
      }
      const record = body.record || body;
      if (!record || typeof record !== 'object' || !record.credentialSubject) {
        return json({ error: 'record-required' }, 400);
      }
      const envelope = await toPacs008(record);
      return json({ envelope, note: 'Attestation carriage only. Amount is 0. Signature check: node protocol/qfs/envelope.mjs' });
    }
    return json({ error: 'not-found' }, 404);
  },
};
