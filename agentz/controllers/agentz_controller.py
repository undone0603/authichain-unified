from __future__ import annotations

import json
from typing import Any

from agentz.models import AgentOutput


class AgentzController:
    """
    Small controller for AgentZ LLM interactions.

    This version imports AgentOutput directly from agentz.models (created in the
    repository). run_llm will parse string LLM results via
    AgentOutput.model_validate_json(...) with a fallback to json.loads +
    AgentOutput.model_validate(...).
    """

    def __init__(self, llm_client: Any):
        """llm_client should be a callable or an object with __call__ that returns
        the LLM response (string/dict/AgentOutput).
        """
        self.llm = llm_client

    def run_llm(self, *args, **kwargs) -> Any:
        """
        Invoke the LLM client and normalize the response.

        Behavior:
        - If the raw result is already an instance of AgentOutput, return it.
        - If the raw result is a string, try AgentOutput.model_validate_json(raw_result).
          If that fails, fall back to json.loads + AgentOutput.model_validate(...).
        - If the raw result is a dict, try AgentOutput.model_validate(raw_result).
        - Otherwise, return the raw result unchanged.

        Returns:
            AgentOutput | Any
        """
        raw_result = self.llm(*args, **kwargs)

        # If already an instance, return directly
        try:
            if isinstance(raw_result, AgentOutput):
                return raw_result
        except Exception:
            # Some dynamic model classes may not support isinstance checks across modules;
            # we'll fall through to other parsing attempts.
            pass

        # If the LLM returned a JSON string, prefer model_validate_json
        if isinstance(raw_result, str):
            try:
                return AgentOutput.model_validate_json(raw_result)
            except Exception as first_exc:
                # Fallback to parsing JSON object + model_validate
                try:
                    payload = json.loads(raw_result)
                    return AgentOutput.model_validate(payload)
                except Exception as second_exc:
                    raise RuntimeError(
                        "AgentzController.run_llm: failed to parse LLM string output into AgentOutput. "
                        f"model_validate_json error: {first_exc!r}; fallback json+model_validate error: {second_exc!r}"
                    ) from second_exc

        # If a dict-like object, try direct validation
        if isinstance(raw_result, dict):
            try:
                return AgentOutput.model_validate(raw_result)
            except Exception as e:
                raise RuntimeError(
                    f"AgentzController.run_llm: failed to validate dict output into AgentOutput: {e!r}"
                ) from e

        # Otherwise return as-is
        return raw_result
