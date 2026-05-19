"""
agentz.workflows.handlers.composite
----------------------------------
Generic handler for composite workflows that primarily rely on
prerequisites defined in registry.yaml.
"""
from agentz.core.modes import ExecutionContext

def run(ctx: ExecutionContext) -> str:
    ctx.step(f"Executing composite workflow: {ctx.workflow_id}")
    return "composite execution complete"
