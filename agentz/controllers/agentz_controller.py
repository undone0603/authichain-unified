from __future__ import annotations

from typing import Any, Callable

from ..models import AgentOutput


class AgentzController:
    """
    Controller for managing LLM interactions and normalizing agent outputs.
    """

    def __init__(self, llm: Callable):
        self.llm = llm

    def run_llm(self, *args, **kwargs) -> AgentOutput | Any:
        """
        Executes the LLM with the provided arguments and attempts to parse the result
        into an AgentOutput object.
        """
        raw_result = self.llm(*args, **kwargs)

        # If already an instance, return directly
        try:
            if isinstance(raw_result, AgentOutput):
                return raw_result
        except Exception:
            pass

        if isinstance(raw_result, str):
            try:
                return AgentOutput.model_validate_json(raw_result)
            except Exception:
                # If it's not JSON, just return as a raw string (BaseAgent handles this)
                return raw_result

        # If a dict-like object, try direct validation
        if isinstance(raw_result, dict):
            try:
                return AgentOutput.model_validate(raw_result)
            except Exception as e:
                raise RuntimeError(
                    f"AgentzController.run_llm: failed to validate dict into AgentOutput: {e!r}"
                ) from e

        return raw_result
