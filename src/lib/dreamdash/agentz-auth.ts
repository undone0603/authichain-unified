// AgentZ may manage /founders APIs with a configured bearer. Fail closed.
// Does not thaw outreach. Does not email leads.

export type FoundersActor = "founder" | "agentz";

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function providedAgentSecrets(headers: Headers): string[] {
  const out: string[] = [];
  const bearer = headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) out.push(bearer);
  for (const name of ["x-agentz-secret", "x-agentz-key", "x-agent-secret", "x-internal-secret"]) {
    const value = headers.get(name)?.trim();
    if (value) out.push(value);
  }
  return out;
}

export function configuredAgentSecrets(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string[] {
  return [
    env.AGENTZ_WEBHOOK_SECRET,
    env.AGENTZ_API_KEY,
    env.AGENT_SECRET,
    env.INTERNAL_API_SECRET,
  ].filter((value): value is string => Boolean(value && value.trim()));
}

export function isAgentzRequest(
  headers: Headers,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  const configured = configuredAgentSecrets(env);
  if (!configured.length) return false;
  return providedAgentSecrets(headers).some((provided) =>
    configured.some((secret) => timingSafeEqualStrings(provided, secret)),
  );
}
