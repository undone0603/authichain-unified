export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Retries an async function with exponential backoff + full jitter.
 * Safe for both Node.js and Cloudflare Workers (no Node-specific APIs).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 500, maxDelayMs = 30_000, onRetry } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;

      // Full jitter: random value in [0, min(cap, base * 2^attempt)]
      const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const delay = Math.random() * cap;
      onRetry?.(attempt, err);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Retries a fetch call, returning the Response on success.
 * Throws on network error or non-2xx after all attempts.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  return withRetry(async () => {
    const res = await fetch(input, init);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
    }
    return res;
  }, options);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
