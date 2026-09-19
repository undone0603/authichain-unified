/**
 * Map Worker secrets onto the env names agentz.core.credentials.get() reads.
 *
 * credentials.get keys → env vars:
 *   agent_secret         → AGENT_SECRET
 *   supabase_url         → SUPABASE_URL
 *   supabase_service_key → SUPABASE_SERVICE_ROLE_KEY
 *
 * Operators may also set SUPABASE_SERVICE_KEY (shorter alias). Either name
 * is forwarded as SUPABASE_SERVICE_ROLE_KEY so get("supabase_service_key") works.
 */
export type AgentZSecretBindings = {
  AGENT_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export function containerEnvFromBindings(
  bindings: AgentZSecretBindings
): Record<string, string> {
  const out: Record<string, string> = {};
  if (bindings.AGENT_SECRET) {
    out.AGENT_SECRET = bindings.AGENT_SECRET;
  }
  if (bindings.SUPABASE_URL) {
    out.SUPABASE_URL = bindings.SUPABASE_URL;
  }
  const serviceKey =
    bindings.SUPABASE_SERVICE_ROLE_KEY || bindings.SUPABASE_SERVICE_KEY || "";
  if (serviceKey) {
    out.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
    out.SUPABASE_SERVICE_KEY = serviceKey;
  }
  return out;
}
