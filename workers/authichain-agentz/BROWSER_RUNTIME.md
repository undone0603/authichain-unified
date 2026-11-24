# AgentZ image: Playwright Chromium sandbox and `/dev/shm`

The linux/arm64 AgentZ API image (`workers/authichain-agentz/Dockerfile`)
installs the Playwright Python package already pinned in
`requirements-agentz.txt` (`playwright==1.60.0`) plus **Chromium only**
(not Firefox or WebKit). That is what AgentZ browser workflows import:
direct `playwright.sync_api` (Glama audit) and `browser-use` (Playwright
Chromium). No paid browser provider, extra account, or extra Python pin.

## Run as non-root under a locked-down profile

The image `USER` is `agentz` (uid 10001 by default; override at build with
`--build-arg AGENTZ_UID=<uid>`). Host switch often runs the container as
the laptop uid, not 10001. Runtime-written dirs (`/app/agentz/logs`,
`/app/.xdg`, `/tmp/agentz-runtime`) are owned `agentz:0` with `g=u` (not
world-writable). Add `--group-add 0` so that host uid can write them.

```bash
docker run --rm \
  --user "$(id -u)" \
  --group-add 0 \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  -p 127.0.0.1:8000:8000 \
  agentz-host:<sha>
```

The image default (`USER agentz`) still works without `--user`. Keep
`--group-add 0` whenever the process is not uid 10001. Optional instead
of the launcher flag below: `--shm-size=1g`.

## Writable paths independent of `HOME`

The host may inject `HOME=/home/<laptop-user>`, a directory that does not
exist in the image. Config and caches do **not** follow `HOME`. The image
sets:

| Variable | Path |
| --- | --- |
| `XDG_CONFIG_HOME` | `/app/.xdg/config` |
| `XDG_CACHE_HOME` | `/app/.xdg/cache` |
| `XDG_DATA_HOME` | `/app/.xdg/data` |
| `XDG_RUNTIME_DIR` | `/tmp/agentz-runtime` |
| `BROWSER_USE_CONFIG_DIR` | `/app/.xdg/config/browseruse` |
| `PLAYWRIGHT_BROWSERS_PATH` | `/opt/ms-playwright` |

`agentz.core.chromium_runtime.ensure_writable_runtime_dirs()` creates those
XDG / browser-use directories at launch if they are missing.

## Chromium sandbox (AgentZ Playwright launcher)

Chromium's **setuid sandbox cannot run** here: the process is non-root,
capabilities are dropped, and `no-new-privileges` blocks a setuid helper.

Plan:

1. **Prefer the user-namespace sandbox.** The AgentZ Playwright launcher
   (`agentz.core.chromium_runtime`) passes `--disable-setuid-sandbox` so
   Chromium uses userns. That needs no extra Docker capabilities when the
   host allows unprivileged user namespaces.
2. **Fallback `--no-sandbox` only on a sandbox error.** If userns spawn
   fails with a clear sandbox failure (`No usable sandbox`, namespace
   sandbox, setuid/suid sandbox helper), retry once with `--no-sandbox`
   and log a WARN. Generic errors (missing binary, timeout, crash) do
   **not** disable the sandbox. Tradeoff on fallback: weaker process
   isolation, still non-root, no added caps, no new privileges. Do not
   promote this flag to other binaries or a container sysctl. Force it
   with `AGENTZ_CHROMIUM_NO_SANDBOX=1`.
3. Chosen mode is `last_sandbox_mode()` (`userns` or `no-sandbox`) and
   the smoke JSON field `sandbox_mode`.

## `browser-use` always adds `--no-sandbox` when `IN_DOCKER=1`

`browser-use` 0.11.13 (`CHROME_DOCKER_ARGS` in
`browser_use/browser/profile.py`) appends `--no-sandbox`,
`--disable-setuid-sandbox`, and `--disable-dev-shm-usage` whenever
`CONFIG.IN_DOCKER` is true (`IN_DOCKER` env, or `/.dockerenv`). This
image sets `IN_DOCKER=1`, so **every `browser-use` Chromium launch in
the container uses `--no-sandbox`**. That is the library's Docker
profile. AgentZ does not patch it. The AgentZ Playwright launcher above
is the path that still tries userns first.

## `/dev/shm`

Docker's default `/dev/shm` is 64 MB. Chromium's shared-memory segment
often exceeds that and the browser dies with a crash in `DevToolsActivePort`.

- **Default in this image:** the AgentZ launcher always passes
  `--disable-dev-shm-usage` (uses `/tmp` instead of `/dev/shm`).
- **Alternative:** `docker run --shm-size=1g ...` and keep the default
  shm path. The in-image smoke does **not** require `--shm-size`.

## Smoke

Inside the image (self-hosted ARM64 artifact job, or local with the
image built). `--group-add 0` matches the host-switch run:

```bash
docker run --rm --cap-drop ALL --security-opt no-new-privileges --group-add 0 \
  agentz-host:<sha> python -m agentz.core.chromium_runtime --smoke
```

The smoke imports Playwright, launches headless Chromium, and opens
`about:blank`. It does not visit the network. JSON includes `ok` and
`sandbox_mode`. The self-hosted artifact job then adds measured
`image_bytes` (docker image Size) and `archive_bytes` (gzip archive).
Hosted CI does not build this linux/arm64 image; set
`AGENTZ_BROWSER_SMOKE=0` to refuse a launch.

## Host LM Studio from the container

`LOCAL_MODEL_URL` defaults to `http://127.0.0.1:1234`. Inside the
container that address is the **container**, not the laptop. LM Studio
now listens only on host `127.0.0.1`.

`--add-host=host.docker.internal:host-gateway` with
`LOCAL_MODEL_URL=http://host.docker.internal:1234` does **not** reach a
loopback-only LM Studio. Traffic to `host.docker.internal` lands on the
host Docker bridge (for example `172.17.0.1`), not on `127.0.0.1`. Do
not bind LM Studio to the LAN (`0.0.0.0` or a `192.168.*` address) to
paper over that.

The option that works **without** a LAN bind is Linux `--network host`,
so the container shares the host network namespace and
`http://127.0.0.1:1234` is the host LM Studio:

```bash
docker run --rm \
  --network host \
  --user "$(id -u)" \
  --group-add 0 \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  -e LOCAL_MODEL_URL=http://127.0.0.1:1234 \
  agentz-host:<sha>
```

`--network host` is Linux-only. This image's default `docker run` and
the ARM64 artifact smoke do **not** add it (they do not call LM Studio).
Do not enable host networking unless the operator needs the local model
from inside the container.
