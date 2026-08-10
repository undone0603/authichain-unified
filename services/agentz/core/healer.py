"""
agentz.core.healer
-----------------
Self-healing logic for AgentZ. Uses a high-reasoning LLM to analyze
failure states and suggest recovery actions.
"""
from __future__ import annotations
import logging
from typing import Optional
from agentz.core.llm import get_llm

logger = logging.getLogger("agentz.healer")

class Healer:
    def __init__(self, model: str = "gpt-4o"):
        self.llm = get_llm(model=model)

    def suggest_recovery(
        self, 
        task: str, 
        error: str, 
        screenshot_b64: Optional[str] = None,
        history_summary: str = ""
    ) -> str:
        """
        Uses a high-reasoning LLM to analyze the failure and return a new prompt.
        """
        prompt = f"""
You are the AgentZ Recovery System. A browser automation task has failed.
ORIGINAL TASK: {task}
FINAL ERROR: {error}
STEP HISTORY:
{history_summary}

Analyze the failure. Suggest a RECOVERY PROMPT. This is a modified set of instructions that the agent
should follow to bypass the error and complete the original goal.

Focus on:
1. Alternative selectors or buttons.
2. Handling unexpected popups or overlays.
3. Refreshing or navigating back to a known good state.

Return ONLY the recovery prompt text.
"""
        try:
            response = self.llm.invoke(prompt)
            return response.content.strip()
        except Exception as e:
            logger.error(f"Healer LLM call failed: {e}")
            return f"Healer error: {e}"
