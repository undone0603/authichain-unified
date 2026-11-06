# Local capture-script execution evidence

Source script: `CAPTURE-GET.sh` on PR #2333.
Script SHA-256 checked against repository `manifest.sha256`: `08327861e6ad9aec15849b23f0982a50f352e06f84246d7ffd6c415b51602ff2` (MATCH).
`bash -n CAPTURE-GET.sh`: PASS on local Linux.
Execution time: 2026-11-04T03:33:56Z to 2026-11-04T03:33:56Z.
Command: `bash CAPTURE-GET.sh /tmp/authichain-get-probe` using a local copy verified byte-identical by SHA-256.
Exit code: `6`.
`curl` reported: `curl: (6) Could not resolve host: authichain.com`.
HTTP status output: `000` (no HTTP exchange).
Raw response body: absent. Raw-response SHA-256: NOT AVAILABLE.
Recorded no-body reason: `NO_BODY_RECEIVED: no raw-response hash; review DNS/transport diagnostics.`

**Classification: INCONCLUSIVE / local DNS failure.** This is executable script/diagnostic evidence, not live origin HTTP GET confirmation, not endpoint downtime, and not independent operator reproduction. The script sends GET only, with redirects disabled. No POST, payment, registration or production mutation occurred.
