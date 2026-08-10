"""
agentz.core.refactorer
----------------------
Analyzes failing workflows and generates patches using LLM.
"""
from __future__ import annotations
import os
from pathlib import Path
from agentz.core.llm import get_llm
from langchain_core.messages import HumanMessage, SystemMessage

class Refactorer:
    def __init__(self):
        self.llm = get_llm(model="gpt-4o", temperature=0.0)

    def generate_patch(self, workflow_id: str, handler: str, error_trace: str) -> str:
        handler_path = Path(__file__).resolve().parents[1] / "workflows" / f"{handler}.py"
        source_code = handler_path.read_text(encoding="utf-8")
        
        prompt = f"""
        You are an expert Python engineer optimizing autonomous agents.
        A workflow '{workflow_id}' with handler '{handler}' is failing.
        
        Here is the source code:
        ```python
        {source_code}
        ```
        
        Here is the error trace:
        {error_trace}
        
        Analyze the failure and provide a corrected version of the source code.
        Return ONLY the corrected code block.
        """
        
        response = self.llm.invoke([
            SystemMessage(content="You provide only fixed code blocks."),
            HumanMessage(content=prompt)
        ])
        
        # Extract code block
        content = response.content
        if "```python" in content:
            return content.split("```python")[1].split("```")[0].strip()
        elif "```" in content:
            return content.split("```")[1].split("```")[0].strip()
        return content.strip()
