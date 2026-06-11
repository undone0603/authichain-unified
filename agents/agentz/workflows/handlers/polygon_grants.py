"""
agentz.workflows.handlers.polygon_grants
---------------------------------------
Thin wrapper for the generic grant_application handler.
"""
from agentz.core.modes import ExecutionContext
from agentz.workflows.handlers import grant_application

def run(ctx: ExecutionContext) -> str:
    return grant_application.run(ctx)
