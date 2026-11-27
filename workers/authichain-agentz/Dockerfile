# AgentZ FastAPI image for linux/arm64 host evidence and Cloudflare Containers.
# Follows repo-root Dockerfile.agentz (python:3.12-slim, requirements-agentz.txt)
# but CMD is uvicorn — the compose CLI image stays python3 -m agentz.cli.
# Build context is the monorepo root (wrangler.jsonc image_build_context) or the
# sparse host-artifact archive (agentz/ + requirements-agentz.txt).
#
# Browser runtime: Playwright Python is pinned in requirements-agentz.txt
# (playwright==1.60.0). This image installs that package's Chromium only
# (not Firefox/WebKit) at build time. Sandbox /dev/shm plan:
# workers/authichain-agentz/BROWSER_RUNTIME.md
FROM python:3.12-slim AS wheels

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH
COPY requirements-agentz.txt /tmp/requirements-agentz.txt
RUN pip install --no-cache-dir -r /tmp/requirements-agentz.txt \
    && rm -rf /root/.cache/pip

# agent-browser CLI for AGENTZ_BROWSER_BIN (public navigation + GitHub inspection).
# Pinned release binary, sha256-verified per arch. It only drives an external,
# network-isolated browser over CDP (see agentz/runtime/agentz-browser); it is
# never pointed at this image's own Chromium.
FROM python:3.12-slim AS agent_browser
ARG TARGETARCH
ARG AGENT_BROWSER_VERSION=0.43.0
RUN python - <<'EOF'
import hashlib, os, urllib.request
arch = os.environ.get("TARGETARCH") or "arm64"
sha = {
    "arm64": "34be55c2b92d8d199fb9d1d62a905ee5b6ac5b1f3e8c24e5b20597f370d905e5",
    "amd64": "8e69c9fb662514c9cf36e4911e94e913742ba066e55102486350e049dd847612",
}[arch]
name = {"arm64": "agent-browser-linux-arm64", "amd64": "agent-browser-linux-x64"}[arch]
ver = os.environ["AGENT_BROWSER_VERSION"]
url = f"https://github.com/vercel-labs/agent-browser/releases/download/v{ver}/{name}"
data = urllib.request.urlopen(url, timeout=120).read()
got = hashlib.sha256(data).hexdigest()
assert got == sha, f"agent-browser sha256 mismatch: {got}"
os.makedirs("/out", exist_ok=True)
with open("/out/agent-browser", "wb") as fh:
    fh.write(data)
os.chmod("/out/agent-browser", 0o755)
EOF

FROM python:3.12-slim

# Default image user. Host switch often runs as the laptop uid instead;
# state dirs below are group 0 with g=u so `--group-add 0` can write them.
ARG AGENTZ_UID=10001

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH=/opt/venv/bin:$PATH \
    PORT=8000 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright \
    IN_DOCKER=1 \
    XDG_CONFIG_HOME=/app/.xdg/config \
    XDG_CACHE_HOME=/app/.xdg/cache \
    XDG_DATA_HOME=/app/.xdg/data \
    XDG_RUNTIME_DIR=/tmp/agentz-runtime \
    BROWSER_USE_CONFIG_DIR=/app/.xdg/config/browseruse \
    AGENTZ_BROWSER_BIN=/opt/agentz-browser/agentz-browser

COPY --from=wheels /opt/venv /opt/venv

# OS libraries + Playwright's Chromium for this driver version. install-deps
# and the browser download run as root; the runtime user is unprivileged.
# PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is unset during this RUN so Chromium is
# fetched once at build time from Playwright's public CDN (no paid account).
RUN python -m playwright install-deps chromium \
    && python -m playwright install chromium \
    && rm -rf /var/lib/apt/lists/* /tmp/* /root/.cache \
    && find /opt/ms-playwright -mindepth 1 -maxdepth 1 -type d \( -iname '*firefox*' -o -iname '*webkit*' \) -exec rm -rf {} +

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN useradd --create-home --uid ${AGENTZ_UID} --shell /usr/sbin/nologin agentz \
    && mkdir -p /app \
    && chown -R agentz:agentz /app /opt/ms-playwright /home/agentz

WORKDIR /app
COPY --chown=agentz:agentz requirements-agentz.txt .
COPY --chown=agentz:agentz agentz ./agentz
# Published bot identities: agentz/core/identity.py reads this (GET /identity).
COPY --chown=agentz:agentz workers/authichain-com/src/bot-identities.ts ./workers/authichain-com/src/bot-identities.ts
# Root-owned, read-only for the runtime user: AgentZ can run but not replace these.
COPY --from=agent_browser /out/agent-browser /opt/agentz-browser/agent-browser
COPY agentz/runtime/agentz-browser /opt/agentz-browser/agentz-browser
RUN chmod 755 /opt/agentz-browser /opt/agentz-browser/agent-browser /opt/agentz-browser/agentz-browser

# Runtime-written dirs: group 0 + g=u so any uid in group 0 can write
# (`docker run --user <host-uid> --group-add 0`). Not world-writable.
RUN mkdir -p /app/agentz/logs \
        /app/.xdg/config/browseruse \
        /app/.xdg/cache \
        /app/.xdg/data \
        /tmp/agentz-runtime \
    && chown -R agentz:0 /app/agentz/logs /app/.xdg /tmp/agentz-runtime \
    && chgrp -R 0 /app/agentz/logs /app/.xdg /tmp/agentz-runtime \
    && chmod -R g=u /app/agentz/logs /app/.xdg /tmp/agentz-runtime \
    && chmod -R o-w /app/agentz/logs /app/.xdg /tmp/agentz-runtime \
    && find /app/agentz/logs /app/.xdg /tmp/agentz-runtime -type d -exec chmod 2770 {} +

USER agentz
EXPOSE 8000
CMD ["uvicorn", "agentz.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
