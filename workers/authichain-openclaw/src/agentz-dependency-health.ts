/**
 * Read-only M2M dependency check. Runs inside the already deployed claw
 * Worker, reusing its protected AgentZ bearer and Cloudflare Access token.
 * Never returns secrets, origin response bodies or credentials to callers.
 * Fail-closed on missing token, wrong origin or Access redirect.
 */
import { cloudflareAccessHeaders } from "./access-headers";

export interface AgentzHealthBindings {
  AGENTZ_API_URL?: string;
  AGENTZ_API_KEY?: string;
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
}
export type AgentzHealthState =
  | "healthy" | "not_configured" | "origin_mismatch"
  | "access_denied" | "upstream_unhealthy";
export interface AgentzHealthResult {
  service: "agentz";
  state: AgentzHealthState;
  upstream_status?: number;
}

const TRUSTED_ORIGIN = "https://agentz.authichain.com";

export async function checkAgentzDependency(
  env: AgentzHealthBindings,
  fetchFn: typeof fetch = fetch,
): Promise<AgentzHealthResult> {
  const url = env.AGENTZ_API_URL?.trim().replace(/\/$/, "");
  const bearer = env.AGENTZ_API_KEY?.trim();
  const accessHeaders = cloudflareAccessHeaders(env);
  if (!url || !bearer ||
      !accessHeaders["CF-Access-Client-Id"] ||
      !accessHeaders["CF-Access-Client-Secret"]) {
    return { service: "agentz", state: "not_configured" };
  }
  if (url !== TRUSTED_ORIGIN) {
    // The bearer and Access token must never be transmitted to arbitrary URLs.
    return { service: "agentz", state: "origin_mismatch" };
  }
  try {
    const response = await fetchFn(TRUSTED_ORIGIN + "/health", {
      method: "GET",
      redirect: "manual",
      headers: {
        Authorization: `Bearer ${bearer}`,
        ...accessHeaders,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(4000),
    });
    if (response.status === 301 || response.status === 302 ||
        response.status === 303 || response.status === 307 ||
        response.status === 308 || response.status === 401 ||
        response.status === 403) {
      return { service: "agentz", state: "access_denied", upstream_status: response.status };
    }
    if (response.status !== 200) {
      return { service: "agentz", state: "upstream_unhealthy", upstream_status: response.status };
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object" || !("status" in payload) ||
        payload.status !== "sovereign") {
      return { service: "agentz", state: "upstream_unhealthy", upstream_status: 200 };
    }
    return { service: "agentz", state: "healthy", upstream_status: 200 };
  } catch {
    return { service: "agentz", state: "upstream_unhealthy" };
  }
}
