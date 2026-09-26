# HubSpot Grok connector bound to portal 245112265

Issue: #1018
Source: AuthiChain Board autopilot
Written: 2026-09-23T13:54:41.413Z

# Issue 1018: HubSpot Grok connector portal binding

## Outcome
Confirm the Grok connector is pinned to HubSpot portal `245112265` only. Document the binding surface and the minimum extras a second portal would need (separate OAuth app/install, env/secrets, and worker/route scope). No multi-portal runtime and no deploy claims.

## Files to touch
- `workers/hubspot-grok/wrangler.toml` — portal-scoped vars/bindings
- `workers/hubspot-grok/src/env.ts` — typed portal id / install config
- `apps/web/lib/integrations/hubspot-grok.ts` — server read of bound portal
- `docs/integrations/hubspot-grok.md` — binding + second-portal checklist
- `.env.example` — placeholder names only (no secrets)

## Acceptance checks
- [ ] Single portal id `245112265` is the only configured HubSpot portal reference in connector config/types
- [ ] Docs list what a second portal needs: new HubSpot app install, distinct secrets/bindings, isolated worker env or route key, optional Supabase row keyed by portal id
- [ ] No credentials, tokens, or live install payloads in repo
- [ ] Typecheck/lint for touched packages passes locally
- [ ] Connector code paths reject or no-op when portal id ≠ bound id (explicit guard, no silent fallback)

## Patch sketch
```diff
--- a/workers/hubspot-grok/src/env.ts
+++ b/workers/hubspot-grok/src/env.ts
@@
 export interface Env {
-  HUBSPOT_PORTAL_ID?: string;
+  /** Sole bound HubSpot portal for this connector instance */
+  HUBSPOT_PORTAL_ID: string; // expected: "245112265"
   HUBSPOT_CLIENT_ID: string;
   HUBSPOT_CLIENT_SECRET: string;
 }

--- a/workers/hubspot-grok/src/portal.ts
+++ b/workers/hubspot-grok/src/portal.ts
@@
+const BOUND_PORTAL = "245112265";
+
+export function assertBoundPortal(portalId: string, env: Env) {
+  const bound = env.HUBSPOT_PORTAL_ID || BOUND_PORTAL;
+  if (portalId !== bound) {
+    throw new Error(`HubSpot portal ${portalId} is not bound to this Grok connector`);
+  }
+  return bound;
+}

--- a/docs/integrations/hubspot-grok.md
+++ b/docs/integrations/hubspot-grok.md
@@
+# Portal binding (issue 1018)
+# Bound portal: 245112265
+# Second portal needs: separate HubSpot app install + OAuth secrets,
+# dedicated worker env/bindings (or portal-keyed router), and config
+# row keyed by portal id. This revision does not implement multi-portal.
```
