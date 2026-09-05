"""Base class shared by all platform agents."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from ..lm_studio import LMStudioClient
from ..controllers.agentz_controller import AgentzController
from ..models import AgentOutput


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
        suffix = f" — {self.error}" if not self.ok else ""
        return f"[{status}] {self.name} ({self.duration_ms}ms){suffix}"


# Deterministic templates intentionally left empty.
#
# This previously held canned outputs that short-circuited BaseAgent.run()
# "to save LLM tokens/latency". In practice it silently replaced every real
# LLM call for the affected agents with fabricated content naming real
# companies (Medtronic, Stryker, Abbott) and inventing specific claims -- a
# "$400K recall risk", a contact named "Michael", three medtech leads with
# invented roles. That output was sent as real outbound email.
#
# Do not reintroduce canned content here: any entry added to this dict
# bypasses the agent's real prompt entirely and is indistinguishable from a
# genuine result to every caller.
DETERMINISTIC_TEMPLATES: dict[str, str] = {}

class BaseAgent:
    """Run a named task with LM Studio as the reasoning engine."""

    name: str = "base"
    system_prompt: str = "You are an autonomous agent for the AuthiChain platform."

    def __init__(self, client: LMStudioClient) -> None:
        self.client = client
        # controller accepts the LLM callable (here we use the LMStudioClient.chat method)
        self.controller = AgentzController(self.client.chat)

    def build_prompt(self) -> list[dict[str, str]]:
        raise NotImplementedError

    def run(self) -> AgentResult:
        start = time.monotonic()
        try:
            messages = self.build_prompt()
            # Use the controller to call the LLM and normalize the output
            parsed = self.controller.run_llm(messages)
            duration_ms = int((time.monotonic() - start) * 1000)

            if isinstance(parsed, AgentOutput):
                out_text = parsed.output or ""
                ok_val = bool(parsed.ok) if parsed.ok is not None else True
                details = parsed.details or {}
                return AgentResult(name=self.name, ok=ok_val, output=out_text, duration_ms=duration_ms, details=details)
            else:
                # If controller returned a raw string/dict, coerce to string
                returned_text = str(parsed)
                return AgentResult(name=self.name, ok=True, output=returned_text, duration_ms=duration_ms)
        except Exception as exc:
            duration_ms = int((time.monotonic() - start) * 1000)
            return AgentResult(name=self.name, ok=False, error=str(exc), duration_ms=duration_ms)
