"""
agentz.workflows.handlers.pinecone_trial
----------------------------------------
Pinecone trial expires ~May 2 2026. Decision tree:

  1. Check current usage of gov-opportunities index.
  2. Estimate paid plan cost vs migration cost.
  3. If usage < 100k vectors → recommend migrate to Supabase pgvector.
  4. If usage >= 100k → recommend Starter plan ($70/mo).

Migration path is exposed but not auto-executed in any mode — schema
changes go through manual confirmation regardless of mode flag.
"""
from __future__ import annotations

import httpx

from agentz.core.credentials import get, get_or_placeholder
from agentz.core.modes import ExecutionContext

INDEX_HOST = "https://gov-opportunities-5lzkcnx.svc.aped-4627-b74a.pinecone.io"


def run(ctx: ExecutionContext) -> str:
    api_key = get_or_placeholder("pinecone_api_key", ctx)
    headers = {"Api-Key": api_key, "Content-Type": "application/json"}

    stats = ctx.step(
        "GET /describe_index_stats (current vector count + dim)",
        action=lambda: _describe_stats(headers),
    ) or {}

    vector_count = stats.get("totalVectorCount", 0)
    dimension    = stats.get("dimension", 1536)

    ctx.step(f"index has {vector_count:,} vectors @ {dimension} dims")

    # Decision logic
    if vector_count < 100_000:
        recommendation = "MIGRATE to Supabase pgvector (low volume, free)"
        next_steps = [
            "create table gov_opportunities_vec (id text pk, embedding vector(1536), metadata jsonb)",
            "create index gov_opp_hnsw on gov_opportunities_vec using hnsw (embedding vector_cosine_ops)",
            f"dump all {vector_count:,} vectors via Pinecone fetch API",
            "batch upsert to Supabase (1000/req)",
            "update gov-engine env: VECTOR_BACKEND=pgvector",
            "verify search latency p95 < 200ms",
            "decommission Pinecone trial",
        ]
    else:
        recommendation = "UPGRADE to Pinecone Starter ($70/mo)"
        next_steps = [
            "log in to app.pinecone.io",
            "Settings → Billing → upgrade to Starter",
            "verify gov-opportunities index transitions from trial to paid",
            "no env var changes needed — same endpoint",
        ]

    ctx.step(f"RECOMMENDATION: {recommendation}")
    for i, step in enumerate(next_steps, 1):
        ctx.step(f"  next-step {i}: {step}")

    return f"{vector_count:,} vectors → {recommendation}"


def _describe_stats(headers: dict) -> dict:
    r = httpx.post(f"{INDEX_HOST}/describe_index_stats",
                   headers=headers, json={}, timeout=15.0)
    r.raise_for_status()
    return r.json()
