import { createHash, timingSafeEqual } from "node:crypto";

// The pin must be obtained independently of DATABASE_URL and Supabase REST
// credentials. Do not derive the expected identity from either connection.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_REF = /^[a-z0-9]{20}$/;
const GIT_SHA = /^[a-f0-9]{40}$/i;

function equalFixedDigest(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

/** A dedicated header-only operator secret; query-string keys are forbidden. */
export function authorizedAttestationRequest(
  request: Request,
  expectedKey: string | undefined,
): boolean {
  if (!expectedKey || expectedKey.length < 32) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  if (!match || match[1].length < 32) return false;
  return equalFixedDigest(match[1], expectedKey);
}

export type RuntimeAttestationPins = {
  expectedInstance: string;
  expectedProjectRef: string;
  deployedSha: string;
};

/** Configuration is independently pinned, and cannot be inferred from a URL. */
export function validRuntimeAttestationPins(
  pins: RuntimeAttestationPins,
  effectiveSupabaseUrl: string | undefined,
): boolean {
  if (
    !UUID.test(pins.expectedInstance) ||
    !PROJECT_REF.test(pins.expectedProjectRef) ||
    !GIT_SHA.test(pins.deployedSha) ||
    !effectiveSupabaseUrl
  ) return false;
  try {
    const url = new URL(effectiveSupabaseUrl);
    return (
      url.protocol === "https:" &&
      url.hostname === `${pins.expectedProjectRef}.supabase.co` &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      (url.pathname === "" || url.pathname === "/") &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

/** Reject malformed, missing or mismatched UUIDs without reflecting input. */
export function matchesExpectedDatabase(
  instance: unknown,
  expected: string,
): instance is string {
  return (
    typeof instance === "string" &&
    UUID.test(instance) &&
    UUID.test(expected) &&
    equalFixedDigest(instance.toLowerCase(), expected.toLowerCase())
  );
}

export function safeIdentityFingerprint(instance: string): string {
  return "sha256:" + createHash("sha256").update(instance.toLowerCase()).digest("hex").slice(0, 20);
}
