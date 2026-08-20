#!/usr/bin/env node
/**
 * Prints the certificate chain the database host actually presents.
 *
 * Exists because a TLS failure against the Supabase pooler is otherwise
 * undiagnosable from CI: the error code (SELF_SIGNED_CERT_IN_CHAIN) says only
 * "the root I was given is not one I trust", never which root was offered, and
 * the pooler hostname lives in a secret so it cannot be probed from a laptop.
 *
 * Postgres does not speak TLS on connect — it opens in cleartext and upgrades
 * only after an SSLRequest packet (8 bytes: length 8, magic 80877103) is
 * answered with 'S'. A plain tls.connect() to port 6543 therefore hangs rather
 * than handshaking, so we do the upgrade dance by hand.
 *
 * Prints subject/issuer/validity per chain link. Never prints the connection
 * string, the username or the password.
 *
 * Usage: DATABASE_URL=... node scripts/diagnose-db-tls.mjs
 */
import net from 'node:net';
import tls from 'node:tls';

const SSL_REQUEST = Buffer.from([0, 0, 0, 8, 4, 210, 22, 47]); // len=8, code=80877103

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const raw = process.env.DATABASE_URL;
if (!raw) fail('DATABASE_URL is not set — nothing to diagnose.');

let host, port;
try {
  const parsed = new URL(raw);
  host = parsed.hostname;
  port = Number(parsed.port) || 5432;
} catch {
  fail('DATABASE_URL is not a parseable URL.');
}

console.log(`Probing ${host}:${port}`);

const socket = net.connect({ host, port });
socket.setTimeout(15_000);
socket.on('timeout', () => fail(`Timed out connecting to ${host}:${port}.`));
socket.on('error', err => fail(`TCP error: ${err.message}`));

socket.once('connect', () => socket.write(SSL_REQUEST));

socket.once('data', response => {
  if (response[0] !== 0x53 /* 'S' */) {
    fail(`Server refused TLS upgrade (replied ${JSON.stringify(String.fromCharCode(response[0]))}).`);
  }

  // rejectUnauthorized:false is correct *here* and only here: the entire point
  // is to observe an untrusted chain. No query is issued and no credential is
  // sent over this socket — it is torn down as soon as the chain is printed.
  const secure = tls.connect({ socket, servername: host, rejectUnauthorized: false }, () => {
    console.log(`\nHandshake complete. authorized=${secure.authorized}` +
      (secure.authorizationError ? ` authorizationError=${secure.authorizationError}` : ''));

    const seen = new Set();
    let cert = secure.getPeerCertificate(true);
    let depth = 0;

    console.log('\nChain as presented:');
    while (cert && Object.keys(cert).length && !seen.has(cert.fingerprint256)) {
      seen.add(cert.fingerprint256);
      const name = o => (o ? Object.entries(o).map(([k, v]) => `${k}=${v}`).join(', ') : '(none)');
      const selfSigned = JSON.stringify(cert.subject) === JSON.stringify(cert.issuer);
      console.log(`\n  [${depth}]${selfSigned ? ' (self-signed — this is the root)' : ''}`);
      console.log(`    subject: ${name(cert.subject)}`);
      console.log(`    issuer:  ${name(cert.issuer)}`);
      console.log(`    valid:   ${cert.valid_from} → ${cert.valid_to}`);
      if (depth === 0 && cert.subjectaltname) console.log(`    SAN:     ${cert.subjectaltname}`);

      if (selfSigned) {
        console.log('\n  Root certificate, PEM — put this in the SUPABASE_POOLER_CA secret:\n');
        const b64 = cert.raw.toString('base64').match(/.{1,64}/g).join('\n');
        console.log(`-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----`);
      }

      const next = cert.issuerCertificate;
      if (!next || next === cert) break;
      cert = next;
      depth++;
    }

    secure.end();
    process.exit(0);
  });

  secure.on('error', err => fail(`TLS error: ${err.message}`));
});
