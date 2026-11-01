# OpenClaw → AgentZ machine-authenticated health

The public `GET /health` stays a basic configuration check. It does **not**
prove connectivity with the private AgentZ process behind Cloudflare Access.

This change adds a **bearer-protected** diagnostic:

```
GET https://claw.authichain.com/health/agentz
Authorization: Bearer <existing OPENCLAW_API_KEY or AGENTZ_API_KEY>
```

Call only from an approved operator runner with the **existing protected
secret**. Never paste the credential in a ticket/chat or print response
request headers. This endpoint sends a read-only GET to
`https://agentz.authichain.com/health` with the already bound
`CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`. It does not require
new tokens, disable Cloudflare Access or alter `OPENCLAW_GATEWAY_URL`.

Expected response: `{"service":"agentz","state":"healthy","upstream_status":200}`
when the private FastAPI upstream actually returns `{"status":"sovereign"}`.
Otherwise HTTP 503 with one of `not_configured`, `origin_mismatch`,
`access_denied`, `upstream_unhealthy`. A request without an existing
bridge bearer returns HTTP 401 and performs no upstream call.

Operational boundaries:

- Route does not accept a URL from the user; only the exact HTTPS AgentZ
  host is permitted, avoiding secret leakage to other origins.
- Redirects to Cloudflare Access are not followed; they are a failing
  `access_denied` result, not success.
- Timeout is 4 seconds; arbitrary upstream body and error data are never
  returned. No POST, email, agent command, paid compute or social publication.
- This proves only a **bridge-to-upstream dependency health check**.
  A successful result does not prove cryptographic AgentZ issuance, signed
  outbound authorization, purchase delivery or autonomous revenue.
- Main deployment must use the existing targeted Cloudflare Worker release
  process after branch quality checks and review. Do not copy or expose
  service-token values in GitLab CI variables or change GitHub branch rules.

Test locally: `pnpm --filter authichain-openclaw test`.
