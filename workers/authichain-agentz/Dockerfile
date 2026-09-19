# AgentZ FastAPI on Cloudflare Containers.
# Build context is the monorepo root (see wrangler.jsonc image_build_context).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000

WORKDIR /app

COPY workers/authichain-agentz/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Enough of the agentz tree for /health and /agents (ALL_AGENTS import).
COPY agentz /app/agentz

EXPOSE 8000
CMD ["uvicorn", "agentz.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
