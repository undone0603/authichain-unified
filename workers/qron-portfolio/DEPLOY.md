# qron-portfolio: containment bundle (PM-92)

`worker.js` derives from the deployed version `a0335a2c` (`content/v2`, Oct 2 2026). Changes since then:
- the leaked `?key=authichain2026` removed from the footer link (#1522; see `/workspace/reports/p1-disable/key-scan/qron-portfolio-bundle.diff`);
- form URL :246 and reply line :247 (#1524 e15c3c73);
- " in under 24 hours" removed from :218 (#1524, PM-101).

Never roll back to a0335a2c (re-exposes key).

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

Rollback: `npx wrangler rollback 8781d807-0e4a-44ff-9fb4-751a79bb81c8 --name qron-portfolio -y`, the live #1522 version as of Oct 2, 4:28 PM ET. Never a0335a2c (re-exposes key).

## CFD-103 (PM-94): contact form → `qron.space/autoflow/webhook/lead`

Stacked on the reviewed #1522 bundle above (22,988 B, `4d69eaa8…4fdc`). It changes only three lines:
- line 246, the form's `fetch()` URL, from `qron-automation.undone-k.workers.dev/webhook/lead`
  (workers.dev is off, so leads are lost) to the zone route `https://qron.space/autoflow/webhook/lead`;
- line 247 (PM-99, deletion-only), where the success text "Received! We will reply within 2 hours with your free
  sample." becomes "Received! We will reply." (37 bytes removed, 0 added);
- line 218 (PM-101, deletion-only), where " in under 24 hours" is removed: "Get your first custom QRON art QR code.
  100% scannable guaranteed." (18 bytes removed, 0 added).

**Order matters.** Upload this ONLY after the qron-automation handler from the companion PR
(accepts `/autoflow/webhook/lead`) is the live 100% version. Before that, qron.space/autoflow/webhook/lead
falls through to qron-automation's default 200 text page, so the form would show "Received!"
and the lead would still be lost.

```sh
npx wrangler versions upload worker.js --name qron-portfolio \
  --compatibility-date 2024-01-01 --no-bundle --message "PM-94 PM-99 CFD-103 form -> qron.space/autoflow"
# check: version module == 22,916 B, sha256 d96fa8aab8eb12baacbacbb3bbc0e4eeaee46d195073c4e45049c21d3a40739e,
#        no bindings, compat 2024-01-01
npx wrangler versions deploy <version-id>@100 --name qron-portfolio -y
```

Rollback (in this order):
1. qron-portfolio first: `npx wrangler rollback 8781d807-0e4a-44ff-9fb4-751a79bb81c8 --name qron-portfolio -y`. That's the live #1522 version as of Oct 2, 4:28 PM ET. Never a0335a2c (re-exposes key).
2. Then qron-automation: `npx wrangler rollback f640cc13-5899-42b2-a4b3-e8d48ffbbfeb --name qron-automation -y`, the #1520 code (deployment a16379a8).
