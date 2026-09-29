// src/lib/admin-key.ts
//
// Shared-key gate for owner-only JSON endpoints that are called without a
// Supabase session (dashboards, cron probes).
//
// The key comes ONLY from ADMIN_DASHBOARD_KEY. There is no built-in fallback:
// a literal in this public repo is readable by anyone, so it is not a secret.
// If the variable is unset or shorter than MIN_ADMIN_KEY_LENGTH, every request
// is refused (fail closed).
//
// Accepted carriers, in order:
//   1. Authorization: Bearer <key>
//   2. x-admin-key: <key>
//   3. ?key=<key>   (legacy; query strings end up in access logs, prefer a header)

export const MIN_ADMIN_KEY_LENGTH = 16;

/** Compare two strings without an early exit on the first differing character. */
export function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** The key the caller presented, or null. */
export function presentedAdminKey(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth && /^Bearer\s+/i.test(auth)) {
    return auth.replace(/^Bearer\s+/i, "").trim() || null;
  }
  const header = request.headers.get("x-admin-key");
  if (header) return header.trim() || null;
  const query = new URL(request.url).searchParams.get("key");
  return query ? query : null;
}

/** True only when ADMIN_DASHBOARD_KEY is configured and the caller presented it. */
export function checkAdminKey(
  request: Request,
  expected: string | undefined = process.env.ADMIN_DASHBOARD_KEY
): boolean {
  if (!expected || expected.length < MIN_ADMIN_KEY_LENGTH) return false;
  const presented = presentedAdminKey(request);
  if (!presented) return false;
  return constantTimeEqual(presented, expected);
}
