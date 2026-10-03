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
