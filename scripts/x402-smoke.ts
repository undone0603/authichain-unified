/**
 * Live x402 micropayment smoke against https://authichain.com/api/x402.
 *
 * Env (never log secret values):
 *   POLYGON_PRIVATE_KEY | WALLET_PRIVATE_KEY  funded smoke payer (not live payTo)
 *   DRY_RUN              anything except "false" is a dry run (default dry)
 *   X402_ENDPOINT        default https://authichain.com/api/x402
 *   X402_PAY_TO          default owner-authorized treasury (same as live health payTo)
 *   X402_RPC             optional Base RPC (public mainnet.base.org fallback)
 *
 * Live payTo is the owner's keyed EOA (0x5db5…6AA2), not the $QRON
 * ERC-20 contract (0xAebf…E437) and not the NFT deployer EOA (0xbad4…).
 * See docs/strategy/WEB3_IDENTITY.md.
 *
 * Live succeeds only on HTTP 200 with settlement.trustless + txHash.
 * Prints status + txHash only. Fails clearly if USDC < 0.05 (50000 atomic).
 *
 * Usage:
 *   DRY_RUN=true  pnpm exec tsx scripts/x402-smoke.ts
 *   DRY_RUN=false pnpm exec tsx scripts/x402-smoke.ts
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import { BASE_USDC_ASSET, parsePaymentHeader } from "../src/lib/x402.ts";
import {
  DEFAULT_ENDPOINT,
  DEFAULT_RPC,
  MIN_ATOMIC,
  OPS_PAY_TO,
  describePayer,
  fetchUsdcBalance,
  isDryRun,
  readPrivateKey,
  signExactPayment,
} from "./lib/x402-smoke.ts";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function jsonOrText(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 200) };
  }
}

export async function runX402Smoke(): Promise<void> {
  const dry = isDryRun();
  const endpoint = (process.env.X402_ENDPOINT || DEFAULT_ENDPOINT).replace(
    /\/$/,
    ""
  );
  const payTo = (process.env.X402_PAY_TO || OPS_PAY_TO).trim();
  const rpc = process.env.X402_RPC || DEFAULT_RPC;
  const healthUrl = `${endpoint}/health`;

  const healthRes = await fetch(healthUrl, {
    headers: { accept: "application/json" },
  });
  const health = (await jsonOrText(healthRes)) as {
    status?: string;
    payTo?: string;
    asset?: string;
    pricePerCall?: { atomic?: string };
  };
  if (healthRes.status !== 200 || health.status !== "ready") {
    fail(`health_not_ready http=${healthRes.status} status=${health.status}`);
  }

  const challengePayTo = health.payTo || payTo;
  const amountAtomic = health.pricePerCall?.atomic || MIN_ATOMIC.toString();
  const asset =
    typeof health.asset === "string" && /^0x[a-fA-F0-9]{40}$/.test(health.asset)
      ? health.asset
      : BASE_USDC_ASSET;

  if (
    !dry &&
    health.asset &&
    health.asset.toLowerCase() !== asset.toLowerCase()
  ) {
    fail(
      `live_asset_not_contract health.asset is not Base USDC (expected ${BASE_USDC_ASSET})`
    );
  }
  if (dry && health.asset === "USDC") {
    console.log(
      "dry_run: live accepts still advertise ticker USDC; bind X402_USDC_ASSET then redeploy"
    );
  }

  const key = readPrivateKey();
  if (!key) {
    if (dry) {
      console.log(
        "dry_run: no POLYGON_PRIVATE_KEY/WALLET_PRIVATE_KEY; skipped sign"
      );
      return;
    }
    fail("live smoke requires POLYGON_PRIVATE_KEY or WALLET_PRIVATE_KEY");
  }

  let payer: string;
  try {
    payer = new ethers.Wallet(key).address;
  } catch {
    fail("invalid_private_key");
  }

  console.log(describePayer(payer, challengePayTo));

  const balance = await fetchUsdcBalance({ rpc, owner: payer, asset });
  console.log(`usdc_balance_atomic=${balance.toString()}`);
  if (balance < MIN_ATOMIC) {
    const msg = `usdc_balance_below_min have=${balance.toString()} need=${MIN_ATOMIC.toString()}`;
    if (dry) {
      console.log(
        `dry_run: ${msg} — live dispatch will fail until ~$0.10 USDC lands`
      );
    } else {
      fail(msg);
    }
  }

  const challengeRes = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sealId: "x402-smoke-challenge" }),
  });
  const challenge = (await jsonOrText(challengeRes)) as {
    x402Version?: number;
    accepts?: Array<{ payTo?: string; maxAmountRequired?: string }>;
    extensions?: unknown;
  };
  if (challengeRes.status !== 402) {
    fail(`unpaid_challenge_not_402 http=${challengeRes.status}`);
  }

  const signed = await signExactPayment({
    wallet: new ethers.Wallet(key),
    payTo: challengePayTo,
    amountAtomic,
    asset,
    resource: endpoint,
    extensions: challenge.extensions,
  });
  const parsed = parsePaymentHeader(signed.headerB64);
  if (!parsed?.signature) fail("signed_payload_unparseable");

  if (dry) {
    console.log("dry_run: signed EIP-3009 payload; not posting");
    return;
  }

  const sealId = `x402-smoke-${Date.now()}`;
  const paid = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-PAYMENT": signed.headerB64,
    },
    body: JSON.stringify({ sealId }),
  });
  const body = (await jsonOrText(paid)) as {
    settlement?: { trustless?: boolean; txHash?: string | null };
    error?: string;
  };
  const txHash = body.settlement?.txHash ?? null;
  const trustless = body.settlement?.trustless === true;
  if (paid.status !== 200 || !trustless || !txHash) {
    fail(
      `settle_failed http=${paid.status} trustless=${trustless} error=${body.error ?? "none"}`
    );
  }
  console.log(`status=${paid.status} txHash=${txHash}`);
}

const isMain =
  !!process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  runX402Smoke().catch(err => {
    const message = err instanceof Error ? err.message : "smoke_error";
    fail(message.includes("private") ? "smoke_error" : message);
  });
}
