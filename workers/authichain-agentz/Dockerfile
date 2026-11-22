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

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH=/opt/venv/bin:$PATH \
    PORT=8000 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright \
    IN_DOCKER=1

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

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin agentz \
    && mkdir -p /app \
    && chown -R agentz:agentz /app /opt/ms-playwright /home/agentz

WORKDIR /app
COPY --chown=agentz:agentz requirements-agentz.txt .
COPY --chown=agentz:agentz agentz ./agentz

USER agentz
EXPOSE 8000
CMD ["uvicorn", "agentz.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
