/** Builds the OpenClaw gateway hook request for an outbound notify. */
export function gatewayHookRequest(
  apiKey: string,
  accessHeaders: Record<string, string>,
  body: {
    text: string;
    mode?: string;
    channel?: string;
    to?: string;
    idempotency_key?: string;
  }
): {
  path: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
} {
  const wakeMode = body.mode === "next-heartbeat" ? "next-heartbeat" : "now";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "x-openclaw-token": apiKey,
    ...accessHeaders,
  };

  if (!body.channel && !body.to) {
    return {
      path: "/hooks/wake",
      headers,
      payload: { text: body.text, mode: wakeMode },
    };
  }

  const payload: Record<string, unknown> = {
    text: body.text,
    mode: wakeMode,
    message: body.text,
    deliver: true,
    wakeMode,
  };
  if (body.channel) payload.channel = body.channel;
  if (body.to) payload.to = body.to;
  // The gateway rejects a caller-chosen sessionKey while
  // hooks.allowRequestSessionKey is false, so retries dedupe on this header.
  if (body.idempotency_key) {
    headers["Idempotency-Key"] = `agentz:${body.idempotency_key}`;
  }
  return { path: "/hooks/agent", headers, payload };
}
