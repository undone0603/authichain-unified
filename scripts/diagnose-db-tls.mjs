#!/usr/bin/env node
/**
 * Prints the certificate chain the database host actually presents.
 *
 * Exists because a TLS failure against the Supabase pooler is otherwise
 * undiagnosable from CI: the error code (SELF_SIGNED_CERT_IN_CHAIN) says only
 * "the root I was given is not one I trust", never which root was offered, and
 * the pooler hostname lives in a secret so it cannot be probed from a laptop.
 *
 * Implemented over `openssl s_client -starttls postgres`. Postgres does not
 * speak TLS on connect — it opens in cleartext and upgrades only after an
 * SSLRequest packet is answered with 'S' — and openssl performs that upgrade
 * natively. Delegating also means this script never has to disable certificate
 * validation to observe an untrusted chain: s_client reports a verification
 * failure in its "Verify return code" line and prints the chain regardless,
 * so there is no `rejectUnauthorized: false` anywhere in the codebase.
 *
 * Prints subject/issuer/validity per chain link and the root as PEM. Never
 * prints the connection string, the username or the password.
 *
 * Usage: DATABASE_URL=... node scripts/diagnose-db-tls.mjs
 */
import { spawnSync } from 'node:child_process';

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

console.log(`Probing ${host}:${port} via openssl s_client -starttls postgres`);

const probe = spawnSync(
  'openssl',
  [
    's_client',
    '-starttls', 'postgres',
    '-connect', `${host}:${port}`,
    '-servername', host,
    '-showcerts',
  ],
  { input: '', encoding: 'utf8', timeout: 30_000 },
);

if (probe.error) {
  fail(probe.error.code === 'ENOENT'
    ? 'openssl is not installed on this runner.'
    : `Could not run openssl: ${probe.error.message}`);
}

const output = `${probe.stdout ?? ''}\n${probe.stderr ?? ''}`;

const verifyLine = output.match(/^\s*Verify return code:.*$/m);
if (verifyLine) console.log(`\n${verifyLine[0].trim()}`);

const pems = output.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? [];
if (pems.length === 0) {
  console.error('\nNo certificates were returned. Raw openssl output follows:\n');
  // The connection string is never echoed by s_client, so this is safe to dump.
  console.error(output.trim() || '(no output)');
  process.exit(1);
}

console.log(`\nChain as presented (${pems.length} certificate${pems.length === 1 ? '' : 's'}):`);

let root = null;

pems.forEach((pem, depth) => {
  const info = spawnSync('openssl', ['x509', '-noout', '-subject', '-issuer', '-dates'], {
    input: pem,
    encoding: 'utf8',
  });
  const text = (info.stdout ?? '').trim();
  const field = name => (text.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1] ?? '').trim();

  const subject = field('subject');
  const issuer = field('issuer');
  const selfSigned = subject !== '' && subject === issuer;
  if (selfSigned && !root) root = pem;

  console.log(`\n  [${depth}]${selfSigned ? '  (self-signed — this is the root)' : ''}`);
  for (const line of text.split('\n')) console.log(`    ${line.trim()}`);
});

if (root) {
  console.log('\nRoot certificate — put this in the SUPABASE_POOLER_CA secret:\n');
  console.log(root);
} else {
  console.log('\nNo self-signed root was sent. The chain is rooted in a CA the server ' +
    'did not transmit, which means a public root should verify it — check whether ' +
    "the leaf's SAN actually covers the host above.");
}
