# AgentZ protected ARM64 image: draft-release evidence path

## Why this path exists

GitHub Actions upload-artifact failed on 2026-11-20 (run 44807067388, both attempts) with an account artifact-storage quota error. The protected manual `.github/workflows/agentz-protected-host-artifact.yml` now stores the real same-run image archive, `release.json`, and `SHA256SUMS` as **unpublished GitHub draft-release assets**. The workflow compares each GitHub-returned uploaded asset SHA-256 digest and size to its same-run local bytes and fails closed on mismatch. Release assets have a per-file limit of 2 GiB.

These draft assets are *build evidence*, not a production version release, host launch, or approval to alter Cloudflare ingress. No production deployment is performed by the workflow. The `contents: write` job permission exists solely to create the unpublished evidence release; the job still requires protected `refs/heads/main`.

## Independent retrieval and verification

With an authorized read-capable GitHub identity and the actual run ID and attempt from a **successful** workflow, retrieve the unique draft release:

```bash
repo=undone0603/authichain-unified
tag=agentz-evidence-<RUN_ID>-<RUN_ATTEMPT>
mkdir -p /tmp/agentz-evidence
gh release download "$tag" --repo "$repo" --dir /tmp/agentz-evidence
cd /tmp/agentz-evidence
sha256sum -c SHA256SUMS
jq -r '.source_sha, .image_id, .sha256, .run_id, .run_attempt' release.json
sha256sum agentz-linux-arm64.tar.gz
```

The archive digest must exactly match `release.json.sha256` and the draft-release API's `sha256:` digest. Confirm `release.json.source_sha` equals the protected build run commit. Treat missing digest, mismatched source, changed tag target, incomplete asset, or unverifiable release as failure. Keep the release draft unpublished.

## Host-to-image proof (separate gate)

After independent download and digest verification, a **separately authorized** host operation may load the image (not launch it):

```bash
gzip -dc agentz-linux-arm64.tar.gz | docker load
source_sha="$(jq -r .source_sha release.json)"
expected_image_id="$(jq -r .image_id release.json)"
actual_image_id="$(docker image inspect --format '{{.Id}}' "agentz-host:$source_sha")"
test "$expected_image_id" = "$actual_image_id"
```

Loading an image does not establish which executable is currently serving FastAPI. An authenticated host inspector must also prove the actual running container/image ID matches this image, collect container ID, PID, process start time, and a fresh local `http://127.0.0.1:8000/health` response. If FastAPI runs as a bare-metal uvicorn/Python process rather than from the loaded Docker image, the image-to-process requirement is **not met**. Do not relabel the process; use a separate approved, reversible deployment from the verified image before certifying it.

Only after independent provenance and host runtime verification may the existing healthy `authichain-runner` tunnel gain the narrow `api.agentz.authichain.com -> http://127.0.0.1:8000` ingress. Preserve current Signal and AgentZ dashboard routes, the existing DNS CNAME, and founder-only Cloudflare Access policy. Test unauthenticated rejection and authenticated health/MCP after routing. Do not expose a route merely because an earlier loopback health check passed.

## Scope and controls

No checkout, Stripe, secrets, payment, DNS, tunnel, service restart, or release-publishing action occurs in this build-evidence workflow. The GitHub release remains a draft; the protected ARM64 image is not claimed to be running until independently verified.
