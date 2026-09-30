/**
 * authichain.com/api/v1/* → `authichain-api` (workers/authichain-api).
 *
 * The public REST API (RapidAPI verify/classify/register, JWKS, …) lives on the
 * `authichain-api` Worker and answers on authichain-api.undone-k.workers.dev.
 * On the apex every /api/* path fell through APP_PREFIXES to APP_WORKER
 * (authichain-edge-router), which has no such handlers and answered
 * `{"error":"Not found"}` 404 — e.g. /api/v1/.well-known/jwks.json.
 *
 * Only the exact paths authichain-api serves are forwarded, over the
 * API_WORKER service binding (no public hop, request URL and headers kept, so
 * authichain-api builds jwks_url from https://authichain.com). Everything else
 * under /api/v1 keeps its current owner:
 *   - /api/v1/attestation*, /api/v1/agent-verify* — own zone routes on
 *     authichain-edge-router (never reach this worker on the apex) and the
 *     x402 intercept here;
 *   - /api/v1/attestations/verify — edge-router via APP_WORKER;
 *   - /api/leads/capture, /api/checkout, … — not /api/v1, untouched.
 *
 * Keep AUTHICHAIN_API_V1_PATHS in sync with the endpoint list in
 * workers/authichain-api/index.js (its 404 body). api-v1-routes.test.ts
 * checks that.
 */

export const AUTHICHAIN_API_V1_PATHS = [
  "/api/v1/health",
  "/api/v1/verify",
  "/api/v1/classify",
  "/api/v1/register",
  "/api/v1/products",
  "/api/v1/analytics",
  "/api/v1/me",
  "/api/v1/qr/generate",
  "/api/v1/pricing",
  "/api/v1/industries",
  "/api/v1/keys/create",
  "/api/v1/leads",
  "/api/v1/.well-known/jwks.json",
] as const;

const API_V1_PATHS: ReadonlySet<string> = new Set(AUTHICHAIN_API_V1_PATHS);

export interface ApiV1Env {
  /** Service binding to the `authichain-api` Worker. */
  API_WORKER?: { fetch: (request: Request) => Promise<Response> };
}

export function isAuthichainApiV1Path(pathname: string): boolean {
  return API_V1_PATHS.has(pathname);
}

/**
 * Forward an authichain-api path over the API_WORKER binding. Returns null for
 * any other path, or when the binding is absent (local dev / tests), so the
 * caller keeps today's routing.
 */
export async function tryHandleApiV1(
  request: Request,
  env: ApiV1Env
): Promise<Response | null> {
  if (!env.API_WORKER) return null;
  const { pathname } = new URL(request.url);
  if (!isAuthichainApiV1Path(pathname)) return null;
  return env.API_WORKER.fetch(request);
}
