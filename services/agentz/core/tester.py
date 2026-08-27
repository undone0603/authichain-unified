"""
agentz.core.tester
------------------
Generates and runs reproduction tests to verify patches.
"""
from __future__ import annotations
import subprocess
from pathlib import Path
from agentz.core.llm import get_llm
from langchain_core.messages import HumanMessage, SystemMessage

class TestGenerator:
    def __init__(self):
        self.llm = get_llm(model="gpt-4o", temperature=0.0)

    def generate_test(self, workflow_id: str, handler: str, error_trace: str) -> str:
        handler_path = Path(__file__).resolve().parents[1] / "workflows" / f"{handler}.py"
        source_code = handler_path.read_text(encoding="utf-8")
        
        prompt = f"""
        You are an expert Python engineer.
        A workflow '{workflow_id}' handler '{handler}' is failing.
        
        Source code:
        ```python
        {source_code}
        ```
        
        Error trace:
        {error_trace}
        
        Write a pytest file that imports the handler and reproduces the failure (or mocks the necessary external dependencies).
        Return ONLY the python code for the test.
        """
        
        response = self.llm.invoke([
            SystemMessage(content="You provide only test code blocks."),
            HumanMessage(content=prompt)
        ])
        
        content = response.content
        if "```python" in content:
            return content.split("```python")[1].split("```")[0].strip()
        elif "```" in content:
            return content.split("```")[1].split("```")[0].strip()
        return content.strip()

    def run_test(self, test_content: str) -> bool:
        test_path = Path("/tmp/reproduce_failure.py")
        test_path.write_text(test_content)
        
        result = subprocess.run(["pytest", str(test_path)], capture_output=True)
        return result.returncode == 0
