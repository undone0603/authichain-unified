"""Stub: reddit_post — see _stubs.py for pattern; flesh out when prioritized."""
from agentz.core.modes import ExecutionContext
from agentz.workflows.handlers._stubs import _stub

def run(ctx: ExecutionContext) -> str:
    return _stub(ctx, "reddit_post", [
        "load workflow-specific config",
        "perform side-effects (browser or API)",
        "log results to Supabase audit table",
    ])
