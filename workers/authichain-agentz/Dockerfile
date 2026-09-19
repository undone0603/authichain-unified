# AgentZ FastAPI image for Cloudflare Containers (agentz.authichain.com).
# Follows repo-root Dockerfile.agentz (python:3.12-slim, requirements-agentz.txt)
# but CMD is uvicorn — the compose CLI image stays python3 -m agentz.cli.
# Build context is the monorepo root (wrangler.jsonc image_build_context).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000

RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements-agentz.txt .
RUN pip install --no-cache-dir -r requirements-agentz.txt
COPY . .

EXPOSE 8000
CMD ["uvicorn", "agentz.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
