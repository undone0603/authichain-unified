import type { Env } from "./index";

/**
 * Record API usage in a KV buffer. The scheduled handler flushes
 * accumulated counts to the backend every 5 minutes.
 */
export async function recordUsage(env: Env, tenantId: number, endpoint: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const bufferKey = `usage:${tenantId}:${today}:${endpoint}`;

  const current = await env.USAGE_BUFFER.get(bufferKey);
  const count = parseInt(current || "0", 10) + 1;

  await env.USAGE_BUFFER.put(bufferKey, String(count), { expirationTtl: 90000 });
}

/**
 * Flush all buffered usage to the backend for persistence and billing.
 * Called by the cron trigger every 5 minutes.
 */
export async function flushUsageBuffer(env: Env): Promise<void> {
  // List all usage buffer keys
  const list = await env.USAGE_BUFFER.list({ prefix: "usage:" });

  if (list.keys.length === 0) return;

  // Group by tenant for batch reporting
  const batches: Array<{ tenantId: number; endpoint: string; date: string; count: number }> = [];

  for (const key of list.keys) {
    const value = await env.USAGE_BUFFER.get(key.name);
    if (!value) continue;

    const count = parseInt(value, 10);
    if (count === 0) continue;

    // Parse key: usage:{tenantId}:{date}:{endpoint}
    const parts = key.name.split(":");
    if (parts.length < 4) continue;

    batches.push({
      tenantId: parseInt(parts[1], 10),
      endpoint: parts.slice(3).join(":"),
      date: parts[2],
      count,
    });
  }

  if (batches.length === 0) return;

  // Send to backend
  try {
    const res = await fetch(`${env.BACKEND_URL}/api/internal/usage/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": env.INTERNAL_SECRET,
      },
      body: JSON.stringify({ records: batches }),
    });

    // Only delete keys if backend accepted the data
    if (res.ok) {
      await Promise.all(list.keys.map((key) => env.USAGE_BUFFER.delete(key.name)));
    }
  } catch {
    // Retry on next cron tick
  }
}
