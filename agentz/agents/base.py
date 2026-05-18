"""Base class shared by all platform agents."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from ..lm_studio import LMStudioClient


@dataclass
class AgentResult:
    name: str
    ok: bool
    output: str = ""
    error: str = ""
    duration_ms: int = 0
    details: dict[str, Any] = field(default_factory=dict)

    def __str__(self) -> str:
        status = "OK" if self.ok else "FAIL"
        suffix = f" - {self.error}" if not self.ok else ""
        return f"[{status}] {self.name} ({self.duration_ms}ms){suffix}"


class BaseAgent:
    """Run a named task with LM Studio as the reasoning engine."""

    name: str = "base"
    system_prompt: str = "You are an autonomous agent for the AuthiChain platform."

    def __init__(self, client: LMStudioClient) -> None:
        self.client = client

    def build_prompt(self) -> list[dict[str, str]]:
        raise NotImplementedError

    def run(self) -> AgentResult:
        start = time.monotonic()
        try:
            messages = self.build_prompt()
            output = self.client.chat(messages)
            duration_ms = int((time.monotonic() - start) * 1000)
            return AgentResult(name=self.name, ok=True, output=output, duration_ms=duration_ms)
        except Exception as exc:
            duration_ms = int((time.monotonic() - start) * 1000)
            return AgentResult(name=self.name, ok=False, error=str(exc), duration_ms=duration_ms)
