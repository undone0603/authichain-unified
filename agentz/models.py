from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel


class AgentOutput(BaseModel):
    """
    Standardized model for agent outputs used across the agentz package.

    This model is intentionally permissive so LLM responses that are simple
    strings or lightly-structured objects can be validated and normalized.

    Designed for Pydantic v2 usage (supports `model_validate_json` and
    `model_validate`). If your environment uses Pydantic v1, let me know and
    I'll adapt the helpers accordingly.
    """

    name: Optional[str] = None
    ok: Optional[bool] = None
    output: Optional[str] = None
    error: Optional[str] = None
    duration_ms: Optional[int] = None
    details: Dict[str, Any] = {}


__all__ = ["AgentOutput"]
