"""
Stub handlers for workflows whose full implementation lives in
adjacent modules but which need a placeholder for registry resolution.

Each stub still respects ExecutionContext modes: dry-run prints
intended actions, confirm/auto raise NotImplementedError so the
runner records 'failed' rather than silently no-op'ing.
"""
from agentz.core.modes import ExecutionContext, Mode


def _stub(ctx: ExecutionContext, label: str, steps: list[str]) -> str:
    for s in steps:
        ctx.step(s)
    if ctx.mode == Mode.DRY_RUN:
        return f"dry-run: {label} plan rendered"
    raise NotImplementedError(
        f"{label}: full handler not yet wired. "
        f"Implement in agentz/workflows/handlers/."
    )
