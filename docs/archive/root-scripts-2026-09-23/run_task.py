import asyncio
import sys
from pathlib import Path

# Add current directory to path for imports
sys.path.append(str(Path(__file__).resolve().parent))

from agentz.core.modes import ExecutionContext, Mode
from agentz.core.browser import run_browser_task

async def main():
    # Create context with AUTO mode to avoid interactive prompts
    ctx = ExecutionContext(mode=Mode.AUTO, workflow_id="manual_task")
    
    # Task for the browser agent
    task = "Navigate to https://uncivic-unupsettable-alda.ngrok-free.dev/dashboard. In the sidebar, click the 'Email Campaigns' link. Then click the 'LAUNCH LUXURY MISSION' button."
    
    print(f"Executing task: {task}")
    await run_browser_task(task, ctx)
    print("Task completed.")

if __name__ == "__main__":
    asyncio.run(main())
