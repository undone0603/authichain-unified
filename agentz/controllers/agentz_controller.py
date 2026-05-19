from __future__ import annotations

import importlib
import json
from typing import Any, Optional


# Try to locate AgentOutput in common locations within the package.
_AGENT_OUTPUT_MODULES = (
    "agentz.models",
    "agentz.schemas",
    "agentz.types",
    "agentz.output",
    "agentz.models.output",
    "agentz.types.output",
)

AgentOutput = None
for _mod in _AGENT_OUTPUT_MODULES:
    try:
        m = importlib.import_module(_mod)
        AgentOutput = getattr(m, "AgentOutput", None)
        if AgentOutput is not None:
            _FOUND_MODULE = _mod
            break
    except Exception:
        continue
else:
    _FOUND_MODULE = None


class AgentzController:
    """
    Small controller for AgentZ LLM interactions.

    Notes:
    - This implementation will attempt to locate an `AgentOutput` model at runtime
      in a set of common module paths. If found, `run_llm` will try to parse string
      results via AgentOutput.model_validate_json(...)
    - If no AgentOutput model is discoverable, run_llm will return the raw result
      unchanged (and will print a warning). Update the import modules list above
      if your project defines AgentOutput elsewhere.
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
        - If the raw result is a string and AgentOutput is available, try
          AgentOutput.model_validate_json(raw_result). If that fails, fall back
          to json.loads + AgentOutput.model_validate(...).
        - If the raw result is a dict and AgentOutput is available, try
          AgentOutput.model_validate(raw_result).
        - Otherwise, return the raw result unchanged.

        Returns:
            AgentOutput | Any
        """
        raw_result = self.llm(*args, **kwargs)

        # If we discovered an AgentOutput model, use it for parsing/validation.
        if AgentOutput is not None:
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

            # If it's some other type, return as-is
            return raw_result

        # If we don't have an AgentOutput model, return raw result but warn.
        print(
            "Warning: AgentzController.run_llm: no AgentOutput model found in",
            _FOUND_MODULE or _AGENT_OUTPUT_MODULES,
        )
        return raw_result
