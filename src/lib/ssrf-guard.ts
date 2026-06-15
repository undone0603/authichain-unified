/**
 * @file ssrf-guard.ts
 * Blocks Server-Side Request Forgery by rejecting URLs that resolve
 * to private / loopback / link-local / metadata IP ranges.
 *
 * Call `assertSafeUrl(url)` before passing any user-supplied URL to
 * fetch(), generateLivingQR(), or any outbound HTTP call.
 */

import { lookup } from 'node:dns/promises';
import { isIPv4, isIPv6 } from 'node:net';

const BLOCKED_SCHEMES = new Set(['file:', 'ftp:', 'javascript:', 'data:']);

// RFC-1918 + loopback + link-local + metadata service ranges
const BLOCKED_IPV4_PREFIXES = [
  '10.',
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
  '192.168.',
  '127.',
  '169.254.',  // AWS/GCP/Azure metadata
  '0.',
  '100.64.',   // Carrier-grade NAT
];

const BLOCKED_IPV6_PREFIXES = [
  '::1',         // loopback
  'fc',          // unique local
  'fd',          // unique local
  'fe80',        // link-local
  '::ffff:',     // IPv4-mapped — catches 127.x via ::ffff:127.0.0.1
];

function isBlockedIp(ip: string): boolean {
  if (isIPv4(ip)) {
    return BLOCKED_IPV4_PREFIXES.some(p => ip.startsWith(p));
  }
  if (isIPv6(ip)) {
    const normalised = ip.toLowerCase();
    return BLOCKED_IPV6_PREFIXES.some(p => normalised.startsWith(p));
  }
  return false;
}

/**
 * Throws if the URL is unsafe for outbound server-side fetching.
 * Resolves DNS to catch SSRF via hostname.
 */
export async function assertSafeUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('SSRF_GUARD: Invalid URL');
  }

  if (BLOCKED_SCHEMES.has(parsed.protocol)) {
    throw new Error(`SSRF_GUARD: Scheme '${parsed.protocol}' is not permitted`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`SSRF_GUARD: Scheme '${parsed.protocol}' is not permitted`);
  }

  const host = parsed.hostname;

  // Block bare IP addresses that are in blocked ranges
  if (isIPv4(host) || isIPv6(host.replace(/^\[|]$/g, ''))) {
    const ip = host.replace(/^\[|]$/g, '');
    if (isBlockedIp(ip)) {
      throw new Error(`SSRF_GUARD: IP address '${ip}' is in a blocked range`);
    }
    return; // Routable public IP — allow
  }

  // Block localhost names explicitly
  if (['localhost', 'localtest.me', 'metadata', 'metadata.google.internal'].includes(host)) {
    throw new Error(`SSRF_GUARD: Hostname '${host}' is not permitted`);
  }

  // Resolve DNS and check all returned IPs
  try {
    const addresses = await lookup(host, { all: true });
    for (const addr of addresses) {
      if (isBlockedIp(addr.address)) {
        throw new Error(
          `SSRF_GUARD: Hostname '${host}' resolves to blocked IP '${addr.address}'`
        );
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('SSRF_GUARD')) throw err;
    // DNS resolution failure — block the request
    throw new Error(`SSRF_GUARD: Could not resolve hostname '${host}'`);
  }
}
