# AgentZ Edge Learning Scheduler (Cloudflare, no Vercel)

**Status:** isolated Cloudflare Worker for *read-only public peer feedback*, not the Python AgentZ daemon. This is the edge-compatible learning portion only.

**Execution:** Cloudflare Cron at `17 */6 * * *` (UTC), up to four scheduled checks daily. Each run makes **two unauthenticated HTTPS GET requests** to the fixed official GitHub issue comments API: AuthiChain open-agent alliances issue #2263 and Cedr Guard issue #7. It classifies author metadata but does **not** fetch or interpret comment instructions, call paid APIs, spend funds, send messages, query personal data, or change customer systems. It logs a bounded JSON summary using Cloudflare Worker observability. No secrets, D1, KV, queues or Durable Object bindings.

**Routes:** `GET /health` reports only configuration (never asserts that Cron has fired); `GET /self-test` runs pure synthetic classifier fixtures with zero network; all other routes 404, writes 405. Neither allows triggering a live scan on demand. A missing/failing public source is explicitly `coverage_unknown`, not zero threats or a healthy assertion.

**Security:** user/reviewer names returned by GitHub are public metadata; reports only contain counts, source aliases and next-action labels. An outside comment is *external feedback, not independent verification*. Self comments and bot accounts cannot become an independent verifier or partner. No prompt text is consumed. Upstream responses are capped to 128 KiB each and queries to 30 comments/source; older comments may not be included. No source author/role is cryptographically attested. This service performs **no model-weight training**, no autonomous outreach and **no production authorization**. It does not replace the real Python AgentZ runner / daemon.

**Tests:** `node --test workers/agentz-learning-cron/index.test.mjs`.

**Safety gates:** This Worker is deliberately independent of the existing privileged `authichain-agentz` Worker and its Durable Object. It does not change `humanHold=true` or `production_send=false`. A separate approved host/Cloudflare Container or GitLab runner is still required for the full Python AgentZ runtime, MCP transport and signed actions. Do not mistake the health route or GitHub metadata for that functionality.

**Deployment:** `wrangler deploy --config workers/agentz-learning-cron/wrangler.toml`. Verify Cloudflare GET worker deployments and schedules, call the `/self-test` URL once, then confirm the next real Cron invocation from observability logs before stating the daemon actually executed on schedule.

**Cost:** Cron/Worker invocations use the Cloudflare account's metered or included plan capacity; do not assume free usage, and do not add paid resources or secrets for this component.
