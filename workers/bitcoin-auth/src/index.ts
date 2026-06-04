/**
 * bitcoin-auth — AuthiChain Bitcoin address verification worker
 * Validates BTC address ownership via signed message challenges
 */

import * as secp from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { ripemd160 } from "@noble/hashes/ripemd160";

export interface Env {
  BITCOIN_AUTH_SECRET: string;
  AUTH_KV: KVNamespace;
}

interface ChallengePayload {
  address: string;
  nonce: string;
  timestamp: number;
}

interface VerifyPayload {
  address: string;
  nonce: string;
  signature: string;
}

// ── Bitcoin message hash ─────────────────────────────────────────────────────

function varInt(n: number): Uint8Array {
  if (n < 0xfd) return new Uint8Array([n]);
  const buf = new Uint8Array(3);
  buf[0] = 0xfd;
  new DataView(buf.buffer).setUint16(1, n, true);
  return buf;
}

function bitcoinMessageHash(message: string): Uint8Array {
  const prefix = "\x18Bitcoin Signed Message:\n";
  const msgBytes = new TextEncoder().encode(message);
  const prefixBytes = new TextEncoder().encode(prefix);
  const lenBytes = varInt(msgBytes.length);
  const data = new Uint8Array(prefixBytes.length + lenBytes.length + msgBytes.length);
  data.set(prefixBytes, 0);
  data.set(lenBytes, prefixBytes.length);
  data.set(msgBytes, prefixBytes.length + lenBytes.length);
  return sha256(sha256(data));
}

// ── Base58Check encoding/decoding ────────────────────────────────────────────

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes: Uint8Array): string {
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let result = "";
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) result += "1";
  for (let i = digits.length - 1; i >= 0; i--) result += BASE58_ALPHABET[digits[i]];
  return result;
}

function hash160(pubkey: Uint8Array): Uint8Array {
  return ripemd160(sha256(pubkey));
}

function pubkeyToAddress(pubkey: Uint8Array, mainnet = true): string {
  const h160 = hash160(pubkey);
  const versioned = new Uint8Array(1 + h160.length);
  versioned[0] = mainnet ? 0x00 : 0x6f;
  versioned.set(h160, 1);
  const checksum = sha256(sha256(versioned)).slice(0, 4);
  const withCheck = new Uint8Array(versioned.length + 4);
  withCheck.set(versioned);
  withCheck.set(checksum, versioned.length);
  return base58Encode(withCheck);
}

// ── Signature verification ───────────────────────────────────────────────────

function verifyBitcoinSignature(address: string, message: string, signatureB64: string): boolean {
  try {
    const sigBytes = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
    if (sigBytes.length !== 65) return false;

    const flag = sigBytes[0];
    if (flag < 27 || flag > 34) return false;

    const compressed = flag >= 31;
    const recovery = (flag - (compressed ? 31 : 27)) & 0x03;
    const r = sigBytes.slice(1, 33);
    const s = sigBytes.slice(33, 65);
    const sig = new secp.Signature(BigInt("0x" + [...r].map((b) => b.toString(16).padStart(2, "0")).join("")),
                                   BigInt("0x" + [...s].map((b) => b.toString(16).padStart(2, "0")).join("")));

    const msgHash = bitcoinMessageHash(message);
    const pubkey = sig.recoverPublicKey(msgHash);
    const pubkeyBytes = pubkey.toRawBytes(compressed);
    const derivedAddress = pubkeyToAddress(pubkeyBytes, true);

    return derivedAddress === address;
  } catch {
    return false;
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleChallenge(env: Env): Promise<Response> {
  const nonce = crypto.randomUUID();
  const timestamp = Date.now();
  const challenge: ChallengePayload = { address: "", nonce, timestamp };
  await env.AUTH_KV.put(`nonce:${nonce}`, JSON.stringify(challenge), { expirationTtl: 600 });
  return Response.json({ nonce, timestamp, message: `Sign this nonce to authenticate: ${nonce}` });
}

async function handleVerify(request: Request, env: Env): Promise<Response> {
  const body = await request.json<VerifyPayload>();
  const { address, nonce, signature } = body;

  if (!address || !nonce || !signature) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const stored = await env.AUTH_KV.get(`nonce:${nonce}`);
  if (!stored) {
    return Response.json({ error: "Invalid or expired nonce" }, { status: 401 });
  }

  const challengeMessage = `Sign this nonce to authenticate: ${nonce}`;
  const valid = verifyBitcoinSignature(address, challengeMessage, signature);

  if (!valid) {
    return Response.json({ error: "Signature verification failed" }, { status: 401 });
  }

  await env.AUTH_KV.delete(`nonce:${nonce}`);
  const token = crypto.randomUUID();
  await env.AUTH_KV.put(`session:${token}`, address, { expirationTtl: 3600 });
  return Response.json({ token, address, expiresIn: 3600 });
}

async function handleStatus(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return Response.json({ error: "Missing token" }, { status: 400 });
  const address = await env.AUTH_KV.get(`session:${token}`);
  if (!address) return Response.json({ valid: false }, { status: 401 });
  return Response.json({ valid: true, address });
}

// ── Worker entrypoint ─────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    let response: Response;
    if (request.method === "POST" && url.pathname === "/auth/challenge") {
      response = await handleChallenge(env);
    } else if (request.method === "POST" && url.pathname === "/auth/verify") {
      response = await handleVerify(request, env);
    } else if (request.method === "GET" && url.pathname === "/auth/status") {
      response = await handleStatus(request, env);
    } else {
      response = Response.json({ error: "Not found" }, { status: 404 });
    }

    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
    return new Response(response.body, { status: response.status, headers: newHeaders });
  },
};
