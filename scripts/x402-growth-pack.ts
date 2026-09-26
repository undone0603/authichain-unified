/**
 * Print a PayAPI-ready listing pack from live health.
 *   pnpm exec tsx scripts/x402-growth-pack.ts
 * Does not submit. Does not rebind wallets.
 */
import { x402ListingPack, growthDiscovery } from "../src/lib/x402-growth";

const HEALTH_URL =
  process.env.X402_HEALTH_URL ?? "https://authichain.com/api/x402/health";

async function main() {
  const res = await fetch(HEALTH_URL, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`health ${res.status} from ${HEALTH_URL}`);
  }
  const health = (await res.json()) as {
    payTo?: string | null;
    asset?: string;
    network?: string;
    chainId?: string;
    pricePerCall?: { usd: number; atomic: string };
    ready?: boolean;
    status?: string;
    mode?: string;
  };
  const pack = x402ListingPack(health);
  const growth = growthDiscovery(health);
  process.stdout.write(
    JSON.stringify(
      {
        healthUrl: HEALTH_URL,
        payTo: health.payTo ?? null,
        ready: health.ready ?? false,
        pack,
        directories: growth.directories.map(d => ({
          id: d.id,
          status: d.status,
          listUrl: d.listUrl ?? null,
        })),
      },
      null,
      2
    ) + "\n"
  );
}

main().catch(err => {
  process.stderr.write(String(err instanceof Error ? err.message : err) + "\n");
  process.exit(1);
});
