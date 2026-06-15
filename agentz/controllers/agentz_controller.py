<<<<<<< HEAD
from __future__ import annotations

from typing import Any, Callable

from ..models import AgentOutput


class AgentzController:
    """Wraps an LLM callable and normalizes its output into AgentOutput."""

    def __init__(self, llm: Callable[..., Any]) -> None:
        self.llm = llm

    def run_llm(self, *args, **kwargs) -> AgentOutput | Any:
        """
        Executes the LLM with the provided arguments and attempts to parse the result
        into an AgentOutput object.
        """
        raw_result = self.llm(*args, **kwargs)

        if isinstance(raw_result, AgentOutput):
            return raw_result

        if isinstance(raw_result, str):
            try:
                return AgentOutput.model_validate_json(raw_result)
            except Exception as e:
                return AgentOutput(output=raw_result, ok=False, error=f"Parse failed: {e}")

        if isinstance(raw_result, dict):
            try:
                return AgentOutput.model_validate(raw_result)
            except Exception as e:
                raise RuntimeError(
                    f"AgentzController.run_llm: failed to validate dict into AgentOutput: {e!r}"
                ) from e

        return raw_result
=======
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
        return AgentOutput.model_validate_json(raw_result)

    # If a dict-like object, try direct validation
    if isinstance(raw_result, dict):
        try:
            return AgentOutput.model_validate(raw_result)
        except Exception as e:
            raise RuntimeError(
                f"AgentzController.run_llm: failed to validate dict into AgentOutput: {e!r}"
            ) from e

    return raw_result
>>>>>>> origin/add-agentz-editable
