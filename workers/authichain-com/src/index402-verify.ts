/**
 * 402 Index domain ownership file for authichain.com.
 *
 * https://402index.io/verify step 3: serve the claim's verification_hash
 * (SHA-256 of the secret verification_token) at
 * /.well-known/402index-verify.txt with HTTP 200 and no redirect.
 * Their verifier trims the body and compares it to the stored hash.
 * The token itself is not in this file.
 *
 * Claim created 2026-09-22T03:50:17Z (POST /api/v1/claim, 201).
 * An unverified claim expires 72 hours later; a new claim rotates this hash.
 */
export const INDEX402_VERIFY_PATH = "/.well-known/402index-verify.txt";

export const INDEX402_VERIFICATION_HASH =
  "423fe4bfe20daf3616465b6f496a3a06e2b03d590e77511d1782bf310b7cb2af";

export function tryHandle402IndexVerify(request: Request): Response | null {
  if (new URL(request.url).pathname !== INDEX402_VERIFY_PATH) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  return new Response(
    request.method === "HEAD" ? null : INDEX402_VERIFICATION_HASH,
    {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
