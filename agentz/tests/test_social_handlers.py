"""Social handlers: no bare asyncio.run, dry-run vs live is explicit."""
from __future__ import annotations

import ast
import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, patch

from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers import (
    authichain_social_launch,
    linkedin_post,
    social_launch,
    twitter_post,
)

HANDLERS_DIR = Path(__file__).resolve().parents[1] / "workflows" / "handlers"
SOCIAL_HANDLER_FILES = (
    "social_launch.py",
    "authichain_social_launch.py",
    "twitter_post.py",
    "linkedin_post.py",
)


def _ctx(mode: Mode, workflow_id: str = "test_social", **params) -> ExecutionContext:
    return ExecutionContext(
        mode=mode,
        workflow_id=workflow_id,
        verbose=False,
        parameters=params,
    )


def _asyncio_run_calls(path: Path) -> list[int]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    lines: list[int] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if (
            isinstance(func, ast.Attribute)
            and func.attr == "run"
            and isinstance(func.value, ast.Name)
            and func.value.id == "asyncio"
        ):
            lines.append(node.lineno)
    return lines


def test_social_handlers_do_not_call_bare_asyncio_run():
    for name in SOCIAL_HANDLER_FILES:
        path = HANDLERS_DIR / name
        hits = _asyncio_run_calls(path)
        assert hits == [], f"{name} still calls asyncio.run at lines {hits}"


def test_authichain_social_launch_import_does_not_bind_llm():
    assert not hasattr(authichain_social_launch, "lm_manager")
    assert not hasattr(authichain_social_launch, "distribute_content")


def test_twitter_dry_run_does_not_post():
    with patch.object(twitter_post, "_post_to_twitter", new=AsyncMock()) as mock_post:
        result = twitter_post.run(_ctx(Mode.DRY_RUN, "twitter_post"))
    mock_post.assert_not_called()
    assert "dry-run" in result.lower()
    assert "post" in result.lower() or "thread" in result.lower()


def test_linkedin_dry_run_does_not_post():
    with patch.object(linkedin_post, "_post_to_linkedin", new=AsyncMock()) as mock_post:
        result = linkedin_post.run(_ctx(Mode.DRY_RUN, "linkedin_post"))
    mock_post.assert_not_called()
    assert "dry-run" in result.lower()
    assert "linkedin" in result.lower()


def test_social_launch_dry_run_does_not_post():
    with patch.object(social_launch, "_run_post", new=AsyncMock()) as mock_post:
        result = social_launch.run(_ctx(Mode.DRY_RUN, "launch_post_qron"))
    mock_post.assert_not_called()
    assert "dry-run" in result.lower()


def test_authichain_social_launch_dry_run_skips_distributor():
    # Dry-run must succeed without importing agentz.core.social / langchain.
    result = authichain_social_launch.run(
        _ctx(Mode.DRY_RUN, "authichain_social_launch_orchestrated")
    )
    assert "dry-run" in result.lower()
    assert "no post sent" in result.lower()


def test_twitter_live_inside_running_loop_reports_success():
    async def from_fastapi() -> str:
        with patch.object(
            twitter_post,
            "_post_to_twitter",
            new=AsyncMock(return_value="success: posted thread to X"),
        ):
            return twitter_post.run(_ctx(Mode.AUTO, "twitter_post"))

    result = asyncio.run(from_fastapi())
    assert "success" in result.lower()


def test_linkedin_live_inside_running_loop_reports_success():
    async def from_fastapi() -> str:
        with patch.object(
            linkedin_post,
            "_post_to_linkedin",
            new=AsyncMock(return_value="success: posted to LinkedIn"),
        ):
            return linkedin_post.run(
                _ctx(Mode.AUTO, "linkedin_post", linkedin="Hello LinkedIn")
            )

    result = asyncio.run(from_fastapi())
    assert "success" in result.lower()


def test_linkedin_live_reports_failure_clearly():
    with patch.object(
        linkedin_post,
        "_post_to_linkedin",
        new=AsyncMock(side_effect=RuntimeError("cookie expired")),
    ):
        result = linkedin_post.run(_ctx(Mode.AUTO, "linkedin_post"))
    assert "fail" in result.lower()
    assert "cookie expired" in result.lower()
