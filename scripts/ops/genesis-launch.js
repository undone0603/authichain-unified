/**
 * GENESIS LAUNCHER
 * Hits the automation endpoint to trigger the protocol's first autonomous cycle.
 *
 * Auth source of truth is CRON_SECRET (same as /api/automation/cron,
 * .env.example, and GitHub Actions). CRON_API_KEY is accepted only as a
 * deprecated local alias so existing shells keep working.
 *
 * Usage:
 *   CRON_SECRET=… node scripts/ops/genesis-launch.js
 *   GENESIS_URL=https://authichain.com CRON_SECRET=… node scripts/ops/genesis-launch.js
 */
function resolveCronSecret() {
  const secret = (process.env.CRON_SECRET || process.env.CRON_API_KEY || "").trim();
  const source = process.env.CRON_SECRET
    ? "CRON_SECRET"
    : process.env.CRON_API_KEY
      ? "CRON_API_KEY"
      : null;
  return { secret, source };
}

export function genesisTargetUrl() {
  const base = (
    process.env.GENESIS_URL ||
    process.env.CRON_BASE_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
  return `${base}/api/automation/cron`;
}

export async function triggerGenesis(fetchImpl = fetch) {
  console.log("--- INITIATING GENESIS TRIGGER ---");
  const { secret, source } = resolveCronSecret();
  if (!secret) {
    console.error(
      "❌ TRIGGER FAILED: set CRON_SECRET (CRON_API_KEY is a deprecated alias)"
    );
    return { ok: false, status: 0, error: "missing CRON_SECRET" };
  }
  const url = genesisTargetUrl();
  console.log("Target:", url);
  console.log("Auth:", source);
  try {
    const res = await fetchImpl(url, {
      headers: {
        Authorization: "Bearer " + secret,
      },
    });

    if (res.ok) {
      const data = await res.json();
      console.log("✅ GENESIS SUCCESSFUL:", data.status || data.ok);
      console.log("Timestamp:", data.timestamp);
      return { ok: true, status: res.status, data };
    }
    const text = await res.text();
    console.error("❌ TRIGGER FAILED:", res.status, text);
    return { ok: false, status: res.status, error: text };
  } catch (err) {
    console.error("❌ NETWORK ERROR:", err.message);
    return { ok: false, status: 0, error: err.message };
  }
}

const isDirect =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].endsWith("genesis-launch.js");

if (isDirect) {
  triggerGenesis();
}
