# AgentZ evidence-only ARM64 build dispatch (never production deploy)

This capability is **disabled by default**. It is distinct from the existing
`agentz/core/protected_dispatch.py` and its `deploy-authichain-com.yml` release
function. It only requests the existing manual
`.github/workflows/agentz-protected-host-artifact.yml` build, never deploys
AgentZ, opens a Cloudflare route, signs an attestation, or loads an image.

## Activation (server-side only, after protected merge and independent review)

1. Confirm the **public** repository still uses `main`, that the workflow is
   reviewed and SHA-256 evidence assets remain in an *unpublished draft release*,
   and `ubuntu-24.04-arm` remains a standard GitHub-hosted runner. The workflow
   is deliberately pinned to this runner; no larger or paid runner is permitted.
2. Issue a **fine-grained GitHub PAT for this single repository only**, with
   Actions: **Read and write** (dispatch and read runs), Contents: **Read**
   (source and branch), Commit statuses: **Read** (CircleCI status), Metadata:
   **Read**. Grant no Contents Write, Administration, Secrets, Deployments or
   Codespaces access. Store the token as the host-only
   `AGENTZ_GITHUB_EVIDENCE_TOKEN`; never expose it to callers, logs, GitHub
   issues, a public Worker, a browser, or untrusted PR code. This PAT cannot be
   constrained to one workflow by GitHub, so this dispatcher's hard-coded
   allowlist, separate operator credential and server flags are mandatory.
3. Set these **host-private** settings after reviewing the exact code/build
   and the protections on the corresponding protected `main`:
   - `AGENTZ_EVIDENCE_DISPATCH_ENABLED=true` (default disabled)
   - `AGENTZ_EVIDENCE_APPROVED_MAIN_SHA=<exact 40-character current main SHA>`
   - `AGENTZ_EVIDENCE_APPROVED_WORKFLOW_BLOB_SHA=<exact Git blob SHA of reviewed
     .github/workflows/agentz-protected-host-artifact.yml>`
   - `AGENTZ_EVIDENCE_OPERATOR_TOKEN=<independently stored random operator token>`
   - `AGENTZ_GITHUB_EVIDENCE_TOKEN=<single-repo PAT>`
   All values are *host configuration*, not request-body truth claims. Preserve
   the existing `AGENT_SECRET` protection on the FastAPI endpoint. Do not copy
   the production release token or set `AGENTZ_RELEASE_DISPATCH_ENABLED`.
4. In a trusted authenticated client only, call
   `POST /agentz/github/dispatch-arm64-evidence` with existing `AGENT_SECRET`
   bearer authentication, separate `X-AgentZ-Evidence-Operator-Token` header,
   and body `{"expected_sha":"<40-char SHA>"}`. Caller cannot supply
   `authorized`, `release_gate_passed`, workflow filename, target branch,
   token, or paid-runner choice.

## Enforcement and duplicate suppression

- Re-read GitHub repository/branch, require `public`, `main`, `protected`, and
  the exact authorized SHA. Require active `main-no-direct-push` ruleset
  (ID 24073494), effective on main, with pull-request rule and no exposed
  bypass actors. Absence or ambiguity fails closed.
- Download workflow source **at the same SHA**, verify its *Git blob hash*
  against the owner-approved blob, and require manual dispatch, protected-main
  guard, standard `ubuntu-24.04-arm`, image build and draft-release upload.
- Verify **eight distinct latest CircleCI successful statuses** on the exact
  protected SHA, including `main-quality-gate`, with CircleCI target URLs.
  Also require exact-SHA successful GitHub push runs of `lint.yml` (both
  `lint` and `test` jobs), and `main.yml` (Protected main secret format).
  These are the actual required GitHub push workflows observed on protected
  main; the separate `agentz-ci.yml` was not dispatched on the current main
  SHA and is not represented as a successful check. Missing,
  skipped required, failed, partial and untrusted statuses are not passes.
- Reject any earlier manual build request for the same SHA, regardless of
  whether its result succeeded or failed. Under a single AgentZ host namespace,
  use a private OS-level non-blocking `flock` around the final preflight and
  POST so concurrent callers cannot bypass this check. The protected workflow
  additionally uses SHA-keyed GitHub Actions `concurrency` and refuses to
  execute its Docker build unless its run ID is the **oldest** real manual
  run for that SHA. GitHub API errors or incomplete run lists block the build.
- Dispatch only the fixed workflow, `ref=main`, with the owner-pinned
  `inputs.expected_sha`; its protected job refuses to build if GitHub resolves
  `main` to another SHA between verification and dispatch. Ask GitHub to
  `return_run_details=true`. A response containing a run ID means only that
  GitHub **accepted** the request. A legacy 204 must be recorded as accepted
  with unknown run ID (no fabricated receipt). Never retry automatically.

## Evidence gates after dispatch

Wait for a real successful run and retrieve the actual `agentz-linux-arm64.tar.gz`,
`release.json`, and `SHA256SUMS` from its unpublished `agentz-evidence-<run-id>-<attempt>`
draft release. Independently verify GitHub API asset digests and download bytes,
source SHA, architecture, image ID, and UTC run metadata. A successful build is
**not** proof the running FastAPI process uses that image. An independently
reachable authorized host inspector must then match the exact loaded image ID
to the serving container, PID, start time, and fresh loopback `/health`.
A signed nonce-bound execution receipt additionally requires separately
reviewed issuer/DID keys and a real, deployed receipt handler. None of these
are created by this dispatcher.

No additional spending or hosted browser automation. No token rotation, router
change, production release, image loading, service restart, public API exposure,
or production attestation is authorized by this feature.

## Offline regression check

From repository root:

```bash
python3 -m unittest discover -s tests -p test_agentz_evidence_build_dispatch.py -v
```

All fixture credentials, receipts and workflows are synthetic. The tests
mock every GitHub read and dispatch; running them never creates a workflow.
