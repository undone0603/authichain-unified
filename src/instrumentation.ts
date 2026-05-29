export async function register() {
  // No-op: instrumentation registers on module load.
}

export function onRequestError(
  err: { digest?: string } & Error,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: string; routePath?: string; routeType?: string }
) {
  // Structured error log — visible via: wrangler tail authichain-unified
  // Set SENTRY_DSN as a CF Worker secret to forward these to Sentry.
  const entry = {
    level: 'error',
    digest: err.digest,
    message: err.message,
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    ts: new Date().toISOString(),
  };
  console.error('[authichain]', JSON.stringify(entry));

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  // Forward to Sentry via fetch (no SDK needed — CF Workers compatible)
  try {
    const [, , projectId] = dsn.replace('https://', '').split(/[@/]/);
    const key = dsn.split('//')[1].split('@')[0];
    const envelope = [
      JSON.stringify({ sent_at: entry.ts, dsn }),
      JSON.stringify({ type: 'event' }),
      JSON.stringify({
        level: 'error',
        message: err.message,
        exception: { values: [{ type: err.name, value: err.message }] },
        request: { url: request.path, method: request.method },
        tags: { routePath: context.routePath, routeType: context.routeType },
        timestamp: Date.now() / 1000,
      }),
    ].join('\n');

    fetch(`https://sentry.io/api/${projectId}/envelope/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-sentry-envelope', 'X-Sentry-Auth': `Sentry sentry_key=${key}` },
      body: envelope,
    }).catch(() => undefined); // fire-and-forget; never await in error handler
  } catch {
    // Malformed DSN — ignore
  }
}
