// server/jobs/ecosystem-health.ts
// External uptime check across the product family's live customer-facing
// domains, plus a $QRON on-chain liveness check. Nothing in the existing
// job suite (live-systems-check checks *internal* SaaS integrations —
// Stripe/HubSpot/Gmail/PostHog/GA4) watches whether the actual public
// sites are reachable from the outside.
import { logActivity } from "../db";
import { collectTokenMetrics } from "./token-metrics";

const DOMAINS = [
  { name: "AuthiChain", url: "https://authichain.com" },
  { name: "QRON Space", url: "https://qron.space" },
  { name: "StrainChain", url: "https://strainchain.io" },
  { name: "GovChain", url: "https://govchain.us" },
];

interface DomainCheckResult {
  name: string;
  url: string;
  status: number;
  latencyMs: number | null;
  healthy: boolean;
  error?: string;
}

async function checkDomain(domain: { name: string; url: string }): Promise<DomainCheckResult> {
  const start = Date.now();
  try {
    const res = await fetch(domain.url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "AuthiChain-Ecosystem-Monitor/1.0" },
    });
    const latencyMs = Date.now() - start;
    // Some edge/WAF configs block HEAD or non-browser UAs with 403 even
    // when the site is genuinely up — treat as healthy like the source
    // monitor does, since a hard failure (network error, 5xx) is what
    // actually indicates an outage.
    const healthy = (res.status >= 200 && res.status < 400) || res.status === 403;
    return { name: domain.name, url: domain.url, status: res.status, latencyMs, healthy };
  } catch (error) {
    return {
      name: domain.name,
      url: domain.url,
      status: 0,
      latencyMs: null,
      healthy: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export interface EcosystemHealthResult {
  timestamp: string;
  domains: DomainCheckResult[];
  tokenActive: boolean;
  domainsHealthy: number;
  domainsTotal: number;
  overallStatus: "HEALTHY" | "DEGRADED";
}

export async function runEcosystemHealthCheck(): Promise<EcosystemHealthResult> {
  const [domains, tokenSnapshot] = await Promise.all([
    Promise.all(DOMAINS.map(checkDomain)),
    collectTokenMetrics().catch(() => null),
  ]);

  const domainsHealthy = domains.filter((d) => d.healthy).length;
  const result: EcosystemHealthResult = {
    timestamp: new Date().toISOString(),
    domains,
    tokenActive: tokenSnapshot?.totalSupply != null,
    domainsHealthy,
    domainsTotal: domains.length,
    overallStatus: domainsHealthy === domains.length ? "HEALTHY" : "DEGRADED",
  };

  await logActivity({
    userId: null,
    action: "ecosystem_health_check",
    entityType: "automation",
    entityId: 0,
    details: result,
  });

  return result;
}
