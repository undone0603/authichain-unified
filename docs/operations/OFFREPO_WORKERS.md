# Off-repo Cloudflare workers (goal: snapshot back into workers/)

`docs/NETWORK.md` says these still run on account `4c1869b90f13f86940aa3747839bf420` with source only in `docs/archive/cf-workers/`.

Do not redeploy the archive JS. Next increment: add a wrangler.toml under `workers/<name>` that matches the live script name so the next deploy is not a ghost.

| Live name (NETWORK.md) | Archive bundle | Goal in-repo
|---|---|---|
| gmail-relay-z | gmail-relay-z.js | inbound mail relay. Bind through existing inbound-email worker.
| qron-self-heal | qron-self-heal.js | Import check URLs into worker-app `live-systems-check`.
| qron-daily-ops | qron-daily-ops.js | Same as owner-digest + GROUP A weekly-analytics-digest.
| qron-ai-api | qron-ai-api.js | Generation API. Living cousin: qron-image-gen.
| qron-portfolio | qron-portfolio.js | Sample grid. Completes `/gallery`.

HUMAN: confirm they still exist in the CF dashboard before deleting any archive file.
