"""
Lean FastAPI surface for Cloudflare Containers (agentz.authichain.com).

Boots with requirements-agentz-api.txt only — no LangChain / Playwright / Streamlit.
Full fleet workflows remain on agentz.api.main (install requirements-agentz.txt on a
full host). This app exposes:

  GET  /health
  GET  /agents          (Bearer AGENT_SECRET)
  GET  /workflows       (Bearer AGENT_SECRET)
  POST /architect/cycle (Bearer AGENT_SECRET) — dry-run stub / thin proxy note

OpenClaw Worker should set AGENTZ_API_URL=https://agentz.authichain.com
"""

from __future__ import annotations

import os
from typing import Any, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="AgentZ API (Containers lean)",
    description="Lean AgentZ surface for Cloudflare Containers / OpenClaw bridge.",
    version="1.0.0-containers",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _agent_secret() -> str:
    return (
        os.environ.get("AGENT_SECRET")
        or os.environ.get("AGENTZ_API_KEY")
        or ""
    ).strip()


async def verify_token(authorization: Optional[str] = Header(None)) -> bool:
    secret = _agent_secret()
    if not secret:
        # Misconfigured container — fail closed on protected routes.
        raise HTTPException(status_code=503, detail="AGENT_SECRET not configured")
    if not authorization or authorization != f"Bearer {secret}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "authichain-agentz",
        "surface": "containers-lean",
        "agent_secret": "configured" if _agent_secret() else "not_set",
        "supabase_url": "configured" if os.environ.get("SUPABASE_URL") else "not_set",
        "version": "1.0.0-containers",
    }


@app.get("/agents", dependencies=[Depends(verify_token)])
async def list_agents() -> dict[str, Any]:
    """List registered agents when the full pipeline is importable; else a stub."""
    try:
        from agentz.agents.pipeline import ALL_AGENTS  # type: ignore

        return {
            "agents": [
                {
                    "name": getattr(cls, "name", cls.__name__),
                    "system_prompt": (getattr(cls, "system_prompt", "") or "")[:120],
                }
                for cls in ALL_AGENTS
            ],
            "surface": "containers-lean",
        }
    except Exception as exc:  # noqa: BLE001 — lean image may lack heavy agent deps
        return {
            "agents": [],
            "surface": "containers-lean",
            "note": f"Full agent pipeline not loaded in lean image: {exc}",
            "hint": "Install requirements-agentz.txt on a full host for the complete fleet.",
        }


@app.get("/workflows", dependencies=[Depends(verify_token)])
async def list_workflows() -> dict[str, Any]:
    try:
        from agentz.core.runner import load_registry  # type: ignore

        registry = load_registry()
        return {
            "workflows": [
                {"id": wf.id, "title": getattr(wf, "title", wf.id)}
                for wf in registry.values()
            ],
            "surface": "containers-lean",
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "workflows": [],
            "surface": "containers-lean",
            "note": f"Workflow registry not loaded in lean image: {exc}",
        }


class ArchitectBody(BaseModel):
    mode: str = "dry-run"
    goal: str = "Assess fleet health (lean container stub)."


@app.post("/architect/cycle", dependencies=[Depends(verify_token)])
async def architect_cycle(body: ArchitectBody) -> dict[str, Any]:
    """
    Lean stub: does not run the full Architect. Returns a dry-run acknowledgement
    so the OpenClaw bridge path stays exercisable end-to-end.
    """
    return {
        "report": {
            "cycle_id": "lean-container-stub",
            "goal": body.goal,
            "mode": body.mode,
            "before_healthy": None,
            "after_healthy": None,
            "before_failing": None,
            "after_failing": None,
            "net_improvement": 0,
            "note": (
                "Lean Containers image: architect is a stub. "
                "Run `python -m agentz.core.architect` on a full host for real cycles."
            ),
        }
    }


@app.post("/workflows/{workflow_id}/run", dependencies=[Depends(verify_token)])
async def run_workflow(workflow_id: str, mode: str = "dry-run") -> dict[str, Any]:
    return {
        "workflow_id": workflow_id,
        "status": "skipped",
        "notes": (
            f"Lean Containers image cannot execute '{workflow_id}' "
            f"(requested mode={mode}). Use a full AgentZ host for real runs."
        ),
        "error": None,
        "duration_s": 0,
    }
