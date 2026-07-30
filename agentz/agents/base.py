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


# Predefined deterministic fallbacks for purely internal, non-customer-facing
# output only (e.g. sprint planning). Agents that draft or find real
# customer/prospect content (DRAFT_OUTBOUND_EMAIL, lead-finder agents, etc.)
# must always call the real LLM -- a canned template here would silently
# replace a genuinely personalized draft with fixed, potentially fabricated
# claims about real companies. (A prior version of this dict did exactly
# that: a "DRAFT_OUTBOUND_EMAIL" entry fabricated a cold email naming the
# real company Medtronic with invented specifics, and always fired before
# the real LLM was ever called.)
DETERMINISTIC_TEMPLATES = {
    "PLAN_SPRINT": (
        '{"sprint": "AuthiChain Unified Phase 6", "tasks": ['
        '{"title": "Deterministic Fallback Engine", "points": 5, "assignee": "AgentZ"}, '
        '{"title": "Revenue Dashboard Integration", "points": 8, "assignee": "Frontend"}]}'
    )
}

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
            # Check for deterministic override to save LLM tokens/latency
            if self.name in DETERMINISTIC_TEMPLATES:
                output = DETERMINISTIC_TEMPLATES[self.name]
                duration_ms = int((time.monotonic() - start) * 1000)
                print(f"  ⚡ Using deterministic fallback for {self.name}")
                return AgentResult(name=self.name, ok=True, output=output, duration_ms=duration_ms)

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
            # Final fallback on failure
            if self.name in DETERMINISTIC_TEMPLATES:
                output = DETERMINISTIC_TEMPLATES[self.name]
                duration_ms = int((time.monotonic() - start) * 1000)
                print(f"  ⚠️ LLM Failed ({str(exc)}). Recovered via deterministic template.")
                return AgentResult(name=self.name, ok=True, output=output, duration_ms=duration_ms)
            
            duration_ms = int((time.monotonic() - start) * 1000)
            return AgentResult(name=self.name, ok=False, error=str(exc), duration_ms=duration_ms)
