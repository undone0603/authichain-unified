import { createHash, timingSafeEqual } from "node:crypto";

// The pin must be obtained independently of DATABASE_URL and Supabase REST
// credentials. Do not derive the expected identity from either connection.
const SYSTEM_ID = /^[1-9][0-9]{15,19}$/;
const DATABASE_NAME = /^[a-z][a-z0-9_]{0,62}$/;
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
  expectedSystemId: string;
  expectedDatabaseName: string;
  expectedProjectRef: string;
  deployedSha: string;
};

/** Configuration is independently pinned, and cannot be inferred from a URL. */
export function validRuntimeAttestationPins(
  pins: RuntimeAttestationPins,
  effectiveSupabaseUrl: string | undefined,
): boolean {
  if (
    !SYSTEM_ID.test(pins.expectedSystemId) ||
    !DATABASE_NAME.test(pins.expectedDatabaseName) ||
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

export type RuntimeDatabaseIdentity = {
  system_identifier: string;
  database_name: string;
};

/** Reject malformed, missing or mismatched cluster IDs without reflecting input. */
export function matchesExpectedDatabase(
  value: unknown,
  expectedSystemId: string,
  expectedDatabaseName: string,
): value is RuntimeDatabaseIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const identity = value as Record<string, unknown>;
  return (
    typeof identity.system_identifier === "string" &&
    typeof identity.database_name === "string" &&
    SYSTEM_ID.test(identity.system_identifier) &&
    SYSTEM_ID.test(expectedSystemId) &&
    DATABASE_NAME.test(identity.database_name) &&
    DATABASE_NAME.test(expectedDatabaseName) &&
    equalFixedDigest(identity.system_identifier, expectedSystemId) &&
    equalFixedDigest(identity.database_name, expectedDatabaseName)
  );
}

export function safeIdentityFingerprint(systemId: string, databaseName: string): string {
  return "sha256:" +
    createHash("sha256").update(systemId + ":" + databaseName).digest("hex").slice(0, 20);
}
