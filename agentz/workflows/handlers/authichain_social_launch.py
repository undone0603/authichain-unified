"""
agentz.workflows.handlers.authichain_social_launch
-------------------------------------------------
Orchestrated social distribution. Dry-run never imports the LLM stack.
Live LinkedIn-first: if a LinkedIn session cookie is present, post via
the browser-session handler instead of langchain_openai.
"""
from __future__ import annotations

from pathlib import Path

from agentz.core.async_compat import run_coroutine_sync
from agentz.core.modes import ExecutionContext, Mode

PLATFORMS = ("LinkedIn", "Reddit (r/QRcode)", "Reddit (r/generative)", "Twitter")


def _copy_preview(ctx: ExecutionContext) -> str:
    payload = ctx.parameters or {}
    if isinstance(payload.get("linkedin"), str) and payload["linkedin"].strip():
        return payload["linkedin"].strip()
    posts_path = Path(__file__).resolve().parents[3] / "reddit_qron_launch_posts.md"
    if posts_path.exists():
        return posts_path.read_text(encoding="utf-8")[:200] + "..."
    return "The launch of the Authentic Economy: Autonomous Trust for physical goods."


def run(ctx: ExecutionContext) -> str:
    if ctx.mode == Mode.DRY_RUN:
        ctx.step("would distribute to " + ", ".join(PLATFORMS) + " — no live send")
        return (
            "dry-run: would distribute to LinkedIn, Reddit, Twitter — no post sent"
        )

    from agentz.core.credentials import get

    if get("linkedin_session", required=False):
        from agentz.workflows.handlers import linkedin_post

        note = linkedin_post.run(ctx)
        return f"linkedin-first: {note}"

    try:
        from agentz.core.social import distribute_content
        from agentz.core.llm import lm_manager
    except ImportError as exc:
        return f"failed: social distributor unavailable ({exc})"

    copy_content = _copy_preview(ctx)
    lm_manager.load_model("local-model")
    try:
        ctx.step("Starting orchestrated distribution for: QRON Space Launch")
        run_coroutine_sync(
            lambda: distribute_content(ctx, copy_content[:200] + "...", list(PLATFORMS))
        )
        return "success: Social Siphon complete. Monitoring for engagement..."
    except Exception as exc:
        return f"failed: {type(exc).__name__}: {exc}"
    finally:
        lm_manager.unload_model("local-model")
