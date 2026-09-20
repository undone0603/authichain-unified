"""run_coroutine_sync must work inside a FastAPI-style running loop."""
from __future__ import annotations

import asyncio

import pytest

from agentz.core.async_compat import run_coroutine_sync


async def _add(a: int, b: int) -> int:
    await asyncio.sleep(0)
    return a + b


def test_run_coroutine_sync_without_running_loop():
    assert run_coroutine_sync(lambda: _add(2, 3)) == 5


def test_run_coroutine_sync_inside_running_loop():
    async def from_fastapi() -> int:
        return run_coroutine_sync(lambda: _add(10, 7))

    assert asyncio.run(from_fastapi()) == 17


def test_run_coroutine_sync_propagates_errors():
    async def boom() -> None:
        raise ValueError("nope")

    with pytest.raises(ValueError, match="nope"):
        run_coroutine_sync(lambda: boom())
