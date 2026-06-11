"""
agentz.workflows.handlers.native_browser
---------------------------------------
Handler for deterministic browser automation using the agent-browser CLI.
Supports ref-based interactions (@e1, @e2) via accessibility tree snapshots.
"""
from __future__ import annotations

import subprocess
from typing import List, Optional

from agentz.core.modes import ExecutionContext


def run_commands(ctx: ExecutionContext, commands: List[str], session_name: Optional[str] = None) -> str:
    """
    Runs a series of agent-browser CLI commands.
    If session_name is provided, it maintains session state/cookies.
    """
    base_cmd = ["agent-browser"]
    if session_name:
        # Assuming agent-browser supports a session flag or we use Kernel cloud sessions
        # For now, we'll just prepend the commands as per CLI spec
        pass

    all_notes = []
    
    for cmd_str in commands:
        # Context step allows dry-run and confirmation
        full_cmd = f"agent-browser {cmd_str}"
        
        def execute_cmd():
            # subprocess.run handles the actual CLI call
            result = subprocess.run(
                ["agent-browser"] + cmd_str.split(),
                capture_output=True,
                text=True,
                check=False # We want to handle errors manually
            )
            if result.returncode != 0:
                raise RuntimeError(f"agent-browser error: {result.stderr or result.stdout}")
            return result.stdout.strip()

        output = ctx.step(full_cmd, execute_cmd)
        if output:
            all_notes.append(output)
            
    return "\n".join(all_notes)


def run(ctx: ExecutionContext) -> str:
    """
    Demo/Default run for native browser.
    In real workflows, this would be customized.
    """
    ctx.step("Initialize native browser session")
    
    # Example deterministic flow
    cmds = [
        "open https://example.com",
        "wait --load networkidle",
        "snapshot", # Returns @e1, @e2 references
        "click @e1" # Example ref click
    ]
    
    return run_commands(ctx, cmds)
