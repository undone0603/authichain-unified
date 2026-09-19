# Lean AgentZ FastAPI for Cloudflare Containers.
# Build context must be the REPO ROOT (see wrangler.toml image_build_context).
# Requires Docker locally for `wrangler deploy`.
FROM python:3.12-slim

WORKDIR /app

# System deps kept minimal (no playwright/browsers in this image).
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-agentz-api.txt /app/requirements-agentz-api.txt
RUN pip install --no-cache-dir -r /app/requirements-agentz-api.txt

# Copy AgentZ package + thin API surface only (not the entire monorepo).
COPY agentz /app/agentz

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

EXPOSE 8000

# Health-friendly boot. AGENT_SECRET and Supabase vars come from Container envVars / secrets.
CMD ["uvicorn", "agentz.api.container_app:app", "--host", "0.0.0.0", "--port", "8000"]
