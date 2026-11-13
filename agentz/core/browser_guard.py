"""Fail-closed Browser Use action interceptor for AgentZ.

Never treat a logging-only `ctx.step(description)` as authorization. The
ExecutionContext returns a truthy sentinel only when the *actual per-action*
confirmation succeeds. In AUTO mode Browser Use remains disabled, because
arbitrary model actions cannot be preapproved by an origin allowlist alone.
"""
from __future__ import annotations

import functools
from typing import Any, Callable

from agentz.core.modes import Mode


def attach_interceptor(controller: Any, ctx: Any) -> None:
    if ctx.mode == Mode.AUTO:
        raise RuntimeError("unattended AI browser actions are disabled by policy")
    registry = getattr(controller, "registry", None)
    if registry is None or not callable(getattr(registry, "wrap_all", None)):
        raise RuntimeError("browser action interception unavailable; refusing to run")

    def factory(action: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(action)
        async def guarded(*args: Any, **kwargs: Any) -> Any:
            from browser_use import ActionResult
            name = getattr(action, "__name__", "unknown_browser_action")
            # Never interpolate args/kwargs, page text, cookies or tokens into
            # the confirmation prompt, audit trail or model output.
            description = f"Browser action: {name}"
            if ctx.mode == Mode.DRY_RUN:
                ctx.step(description)
                return ActionResult(extracted_content=f"DRY RUN: {name} not executed")
            if ctx.mode != Mode.CONFIRM:
                raise RuntimeError("browser action mode not permitted")
            # ExecutionContext.step returns True ONLY when user accepts this
            # exact step. Denial or missing interactive stdin returns None.
            approved = ctx.step(description, action=lambda: True)
            if approved is not True:
                return ActionResult(error=f"Browser action {name} not authorized")
            return await action(*args, **kwargs)
        return guarded

    registry.wrap_all(factory)
