# AgentZ image: Playwright Chromium sandbox and `/dev/shm`

The linux/arm64 AgentZ API image (`workers/authichain-agentz/Dockerfile`)
installs the Playwright Python package already pinned in
`requirements-agentz.txt` (`playwright==1.60.0`) plus **Chromium only**
(not Firefox or WebKit). That is what AgentZ browser workflows import:
direct `playwright.sync_api` (Glama audit) and `browser-use` (Playwright
Chromium). No paid browser provider, extra account, or extra Python pin.

## Run as non-root under a locked-down profile

The image `USER` is `agentz` (uid 10001). Run:

```bash
docker run --rm \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  -p 127.0.0.1:8000:8000 \
  agentz-host:<sha>
```

Optional instead of the launcher flag below: `--shm-size=1g`.

## Chromium sandbox

Chromium's **setuid sandbox cannot run** here: the process is non-root,
capabilities are dropped, and `no-new-privileges` blocks a setuid helper.

Plan:

1. **Prefer the user-namespace sandbox.** The AgentZ Playwright launcher
   (`agentz.core.chromium_runtime`) passes `--disable-setuid-sandbox` so
   Chromium uses userns. That needs no extra Docker capabilities when the
   host allows unprivileged user namespaces.
2. **Fallback `--no-sandbox` only in that launcher.** If userns spawn
   fails (common when the kernel honours `no-new-privileges`), retry once
   with `--no-sandbox`. Tradeoff: weaker process isolation, still
   non-root, no added caps, no new privileges. Do not promote this flag
   to other binaries or a container sysctl. Force it with
   `AGENTZ_CHROMIUM_NO_SANDBOX=1`.
3. **`browser-use` 0.11.13** already appends `--no-sandbox` and
   `--disable-dev-shm-usage` when it detects Docker (`/.dockerenv` or
   `IN_DOCKER`). This image sets `IN_DOCKER=1` so that path is
   deterministic. That library's Docker profile is separate from the
   AgentZ Playwright launcher above.

## `/dev/shm`

Docker's default `/dev/shm` is 64 MB. Chromium's shared-memory segment
often exceeds that and the browser dies with a crash in `DevToolsActivePort`.

- **Default in this image:** the AgentZ launcher always passes
  `--disable-dev-shm-usage` (uses `/tmp` instead of `/dev/shm`).
- **Alternative:** `docker run --shm-size=1g ...` and keep the default
  shm path. The in-image smoke does **not** require `--shm-size`.

## Smoke

Inside the image (self-hosted ARM64 artifact job, or local with the
image built):

```bash
docker run --rm --cap-drop ALL --security-opt no-new-privileges \
  agentz-host:<sha> python -m agentz.core.chromium_runtime --smoke
```

The smoke imports Playwright, launches headless Chromium, and opens
`about:blank`. It does not visit the network. Hosted CI does not build
this linux/arm64 image; set `AGENTZ_BROWSER_SMOKE=0` to refuse a launch.
