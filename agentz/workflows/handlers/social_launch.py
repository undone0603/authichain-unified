"""
agentz.workflows.handlers.social_launch
--------------------------------------
Posts launch threads to social platforms (Reddit, LinkedIn, Twitter).
"""
from agentz.core.async_compat import run_coroutine_sync
from agentz.core.browser import run_with_healing, attach_interceptor
from agentz.core.modes import ExecutionContext, Mode


async def _run_post(ctx: ExecutionContext) -> str:
    wid = ctx.workflow_id

    mapping = {
        "launch_post_authichain": ("reddit", "r/blockchain", "Authichain: The Autonomous Compliance Layer for Bitcoin"),
        "launch_post_qron": ("reddit", "r/QRcode", "QRON: Generative AI QR Codes for the On-Chain World"),
        "launch_post_strainchain": ("linkedin", "feed", "StrainChain: Immutable Cannabis Certifications on Bitcoin"),
        "launch_post_govchain": ("twitter", "home", "GovChain: The Autonomous Engine for SBIR/SVIP Government Grants"),
    }

    if wid not in mapping:
        return f"failed: unknown social launch task: {wid}"

    platform, target, title = mapping[wid]
    ctx.step(f"Launching on {platform} ({target}): {title}")

    try:
        from browser_use import Agent, Controller
        from agentz.core.llm import get_llm
        from agentz.core.session_manager import get_browser_with_session
    except ImportError as exc:
        return f"failed: browser-use not installed ({exc})"

    llm = get_llm(model="llama3.2", temperature=0.0)
    controller = Controller()
    attach_interceptor(controller, ctx)

    platform_key = "twitter_session" if platform == "twitter" else f"{platform}_session"
    browser = get_browser_with_session([platform_key])

    task = (
        f"Navigate to {platform}.com, go to {target}, and create a post with title "
        f"'{title}' and description 'Launching AgentZ-orchestrated {wid} today!'. "
        f"Wait for success confirmation."
    )

    agent = Agent(task=task, llm=llm, controller=controller, browser=browser)
    await run_with_healing(agent, ctx)
    return f"success: launch post submitted to {platform}."


def run(ctx: ExecutionContext) -> str:
    if ctx.mode == Mode.DRY_RUN:
        wid = ctx.workflow_id
        ctx.step(f"would post launch thread for {wid} — no live send")
        return f"dry-run: would post launch thread for {wid} — no post sent"
    try:
        return run_coroutine_sync(lambda: _run_post(ctx))
    except Exception as exc:
        return f"failed: {type(exc).__name__}: {exc}"
