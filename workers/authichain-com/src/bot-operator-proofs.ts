/**
 * Operator key-possession proofs for AuthiChain's agents.
 *
 * Each proof is a compact EdDSA JWS signed by the agent's own published key. Its
 * payload names the operator (GitHub account + domain), and the operator published
 * it from that GitHub account (`gist`). The page re-verifies the signature on every
 * render against the key in bot-identities.ts, so a stale or edited proof shows as
 * failed rather than as a claim.
 *
 * What it proves: whoever held this agent's key at `issued_at` named this operator,
 * and the operator's GitHub account published that statement. It does not prove
 * the agent's output is accurate or safe.
 *
 * Produce a new one with `z verify --publish` (scripts/ops/agentz-browser/agentz).
 */
import { verify as edVerify } from "node:crypto";
import { publicKeyFromDidKey } from "../../../protocol/verifier.mjs";

export const OPERATOR_PROOF_TYP = "agentz-possession+jws";

export const OPERATOR_PROOFS: Record<string, { jws: string; gist: string }> = {
  agentz: {
    jws: "eyJhbGciOiJFZERTQSIsImtpZCI6ImRpZDp3ZWI6YXV0aGljaGFpbi5jb206YWdlbnRzOmFnZW50eiNrZXktMSIsInR5cCI6ImFnZW50ei1wb3NzZXNzaW9uK2p3cyJ9.eyJhZ2VudF9pZCI6ImFnZW50OmF1dGhpY2hhaW46YWdlbnR6IiwiZGlkIjoiZGlkOndlYjphdXRoaWNoYWluLmNvbTphZ2VudHM6YWdlbnR6IiwiZGlkX2RvY3VtZW50IjoiaHR0cHM6Ly9hdXRoaWNoYWluLmNvbS9hZ2VudHMvYWdlbnR6L2RpZC5qc29uIiwiZGlkX2tleSI6ImRpZDprZXk6ejZNa2luUUNyTVc3bkMxRkxOVlJVZ29NWDdaZEtSMmI4Z281eGhaYWpaelN2am45IiwiZnJlc2huZXNzIjp7Im1haW5fY29tbWl0IjoiZGRiMGI3MmJmMzQ3OTQyODllMTVlMTgyNTc4ODYwNTY5ODZmNmM1MiIsIm1haW5fY29tbWl0X2RhdGUiOiIyMDI2LTExLTI1VDE0OjM0OjA3LTA1OjAwIiwicmVwbyI6InVuZG9uZTA2MDMvYXV0aGljaGFpbi11bmlmaWVkIn0sImlzc3VlZF9hdCI6IjIwMjYtMTEtMjVUMjI6NTE6MzNaIiwibGltaXRzIjoiUHJvdmVzIHRoZSBwdWJsaXNoZXIgaGVsZCB0aGlzIGtleSBhdCBpc3N1ZWRfYXQgKHNpZ25lZCBhZnRlciBtYWluX2NvbW1pdCBleGlzdGVkKSBhbmQsIHZpYSB0aGUgcHVibGlzaGluZyBHaXRIdWIgYWNjb3VudCwgYmluZHMgdGhhdCBhY2NvdW50IHRvIHRoZSBrZXkuIERvZXMgbm90IHByb3ZlIHRoYXQgQWdlbnRaJ3Mgb3V0cHV0cyBhcmUgYWNjdXJhdGUgb3Igc2FmZSwgb3IgYW55IHRoaXJkLXBhcnR5IGVuZG9yc2VtZW50LiIsIm5vbmNlIjoidDNrT0MzV1BfQWJpbldhVlNZa3c4ZyIsIm9wZXJhdG9yIjp7ImRvbWFpbiI6ImF1dGhpY2hhaW4uY29tIiwiZ2l0aHViIjoidW5kb25lMDYwMyJ9LCJzdGF0ZW1lbnQiOiJUaGUgb3BlcmF0b3Igb2YgQWdlbnRaIChhZ2VudDphdXRoaWNoYWluOmFnZW50eikgaG9sZHMgdGhlIHByaXZhdGUga2V5IGZvciBkaWQ6a2V5Ono2TWtpblFDck1XN25DMUZMTlZSVWdvTVg3WmRLUjJiOGdvNXhoWmFqWnpTdmpuOSBhbmQgY29udHJvbHMgR2l0SHViIGFjY291bnQgdW5kb25lMDYwMyBhbmQgdGhlIGRvbWFpbiBhdXRoaWNoYWluLmNvbSwgd2hpY2ggcHVibGlzaGVzIHRoaXMga2V5LiIsInR5cGUiOiJBZ2VudFpPcGVyYXRvcktleVBvc3Nlc3Npb25Qcm9vZiJ9.kHPh6eknhZ_BRwwB9ggUMfJ0Npm35hwzj4EVyk35a6aLdIvpmoYR-GRW7D5ljEQD2_jxDa8gNz32XgwQu-orCA",
    gist: "https://gist.github.com/undone0603/b3a5fe4338d417036852a7297937c2b3",
  },
};

export type OperatorProofCheck = {
  ok: boolean;
  reasons: string[];
  gist: string;
  operatorGithub?: string;
  operatorDomain?: string;
  issuedAt?: string;
};

const b64 = (s: string) => {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("not base64url");
  return Buffer.from(s, "base64url");
};

export function checkOperatorProof(
  bot: { slug: string; did: string; didKey: string },
  proof = OPERATOR_PROOFS[bot.slug]
): OperatorProofCheck | null {
  if (!proof) return null;
  const reasons: string[] = [];
  const parts = proof.jws.trim().split(".");
  if (parts.length !== 3) return { ok: false, reasons: ["jws_malformed"], gist: proof.gist };
  let header: Record<string, unknown>;
  let payload: Record<string, any>;
  try {
    header = JSON.parse(b64(parts[0]).toString("utf8"));
    payload = JSON.parse(b64(parts[1]).toString("utf8"));
  } catch {
    return { ok: false, reasons: ["jws_malformed"], gist: proof.gist };
  }
  if (header.alg !== "EdDSA") reasons.push("alg_unsupported");
  if (header.typ !== OPERATOR_PROOF_TYP) reasons.push("typ_unexpected");
  if (header.kid !== `${bot.did}#key-1`) reasons.push("kid_mismatch");
  let sigOk = false;
  try {
    sigOk = edVerify(
      null,
      Buffer.from(`${parts[0]}.${parts[1]}`, "ascii"),
      publicKeyFromDidKey(bot.didKey),
      b64(parts[2])
    );
  } catch {
    sigOk = false;
  }
  if (!sigOk) reasons.push("signature_invalid");
  if (payload.did !== bot.did) reasons.push("did_mismatch");
  if (payload.did_key !== bot.didKey) reasons.push("did_key_mismatch");
  const github = payload.operator?.github;
  const domain = payload.operator?.domain;
  if (typeof github !== "string" || !/^[A-Za-z0-9-]{1,39}$/.test(github)) reasons.push("operator_github_invalid");
  else if (!proof.gist.startsWith(`https://gist.github.com/${github}/`)) reasons.push("gist_not_operator_account");
  if (domain !== "authichain.com") reasons.push("operator_domain_unexpected");
  return {
    ok: reasons.length === 0,
    reasons,
    gist: proof.gist,
    operatorGithub: github,
    operatorDomain: domain,
    issuedAt: payload.issued_at,
  };
}
