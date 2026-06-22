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
        except Exception:  # noqa: BLE001
            pass  # isinstance() won't raise; fall through to str/dict checks below

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
