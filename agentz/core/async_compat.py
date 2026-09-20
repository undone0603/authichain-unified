"""
agentz.core.async_compat
------------------------
Run a coroutine from sync workflow handlers.

FastAPI already has a running loop, so `asyncio.run()` raises
RuntimeError. Create the coroutine inside a worker thread (own loop)
when a loop is already running. Callers pass a zero-arg factory so the
coroutine is not bound to the outer loop.
"""
from __future__ import annotations

import asyncio
import concurrent.futures
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")


def run_coroutine_sync(factory: Callable[[], Awaitable[T]]) -> T:
    """Run `factory()` to completion from sync code.

    `factory` must be a zero-arg callable that returns a coroutine (or
    other awaitable). Do not pass an already-created coroutine when a
    loop may be running — it would be bound to the wrong loop.
    """
    if not callable(factory) or asyncio.iscoroutine(factory):
        raise TypeError("run_coroutine_sync expects a zero-arg coroutine factory")

    def _run() -> T:
        result = factory()
        if asyncio.iscoroutine(result) or asyncio.isfuture(result):
            return asyncio.run(result)
        return result  # type: ignore[return-value]

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return _run()

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(_run).result()
