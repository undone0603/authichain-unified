"""Stub: gsc_setup — see _stubs.py for pattern; flesh out when prioritized."""
from agentz.core.modes import ExecutionContext
from agentz.workflows.handlers._stubs import _stub

def run(ctx: ExecutionContext) -> str:
    return _stub(ctx, "gsc_setup", [
        "load workflow-specific config",
        "perform side-effects (browser or API)",
        "log results to Supabase audit table",
    ])
