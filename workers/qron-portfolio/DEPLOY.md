# qron-portfolio: containment bundle (PM-92)

`worker.js` is the deployed version `a0335a2c` (`content/v2`, Oct 2 2026) byte for byte,
except one footer link that drops the leaked `?key=authichain2026`
(see `/workspace/reports/p1-disable/key-scan/qron-portfolio-bundle.diff`).

qron-portfolio stays an **off-repo Worker** in `config/estate.json` (disposition `archive`).
On purpose, there's no wrangler config here, so the estate inventory and `deploy-workers.yml`
don't pick it up.

Upload only after the Auditor gives Reviewed-by and PM gives go. Use `versions upload`/`versions deploy` only,
never `wrangler deploy`:

```sh
cd workers/qron-portfolio
npx wrangler versions upload worker.js --name qron-portfolio \
  --compatibility-date 2024-01-01 --no-bundle --message "PM-92 drop ?key link"
# check: version module == 22,988 B, sha256 4d69eaa8f419bc12a67e7a78692cb81eed87a19e42e100ca205bb76c41ab4fdc,
#        no bindings, compat 2024-01-01
npx wrangler versions deploy <version-id>@100 --name qron-portfolio -y
```

Rollback: `npx wrangler rollback a0335a2c-80f9-4484-9654-f46b9a3abc9f --name qron-portfolio -y`.

## CFD-103 (PM-94): contact form → `qron.space/autoflow/webhook/lead`

Stacked on the reviewed #1522 bundle above (22,988 B, `4d69eaa8…4fdc`). It changes only line 246,
the form's `fetch()` URL, from `qron-automation.undone-k.workers.dev/webhook/lead`
(workers.dev is off, so leads are lost) to the zone route `https://qron.space/autoflow/webhook/lead`.

**Order matters.** Upload this ONLY after the qron-automation handler from the companion PR
(accepts `/autoflow/webhook/lead`) is the live 100% version. Before that, qron.space/autoflow/webhook/lead
falls through to qron-automation's default 200 text page, so the form would show "Received!"
and the lead would still be lost.

```sh
npx wrangler versions upload worker.js --name qron-portfolio \
  --compatibility-date 2024-01-01 --no-bundle --message "PM-94 CFD-103 form -> qron.space/autoflow"
# check: version module == 22,971 B, sha256 260a8de1b1705f5220bf10a0addb597ccc665919b90ab1d8f439e122fd0120f4,
#        no bindings, compat 2024-01-01
npx wrangler versions deploy <version-id>@100 --name qron-portfolio -y
```

Rollback: the #1522 version id (the 22,988 B upload); if that's unknown, `a0335a2c-80f9-4484-9654-f46b9a3abc9f`.
