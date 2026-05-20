"""
agentz.core.browser
------------------
Utilities for integrating browser-use agents with AgentZ modes.
Provides action interception for human-in-the-loop confirmation
and self-healing recovery loops.
"""
from __future__ import annotations

import asyncio
import functools
import logging
from typing import Any, Callable, TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from browser_use import Agent, Controller, ActionResult
    from agentz.core.modes import ExecutionContext

logger = logging.getLogger("agentz.browser")


def attach_interceptor(controller: Controller, ctx: ExecutionContext):
    """
    Wraps all actions in the controller to route through ctx.step.
    In confirm mode, this will prompt the user before each browser action.
    """
    
    def intercept_wrapper(action_func: Callable):
        @functools.wraps(action_func)
        async def wrapper(*args, **kwargs):
            action_name = action_func.__name__
            params = ", ".join(f"{k}={v}" for k, v in kwargs.items() if v and k != "browser_session")
            description = f"browser: {action_name}({params})"
            
            res = ctx.step(description)
            
            from agentz.core.modes import Mode
            if ctx.mode == Mode.DRY_RUN:
                from browser_use import ActionResult
                return ActionResult(extracted_content=f"Dry-run: would {description}")
            
            if res is None and ctx.mode == Mode.CONFIRM:
                from browser_use import ActionResult
                return ActionResult(error="Action cancelled by user.")

            return await action_func(*args, **kwargs)

        return wrapper

    if hasattr(controller.registry, "wrap_all"):
        controller.registry.wrap_all(intercept_wrapper)
    else:
        logger.warning("Controller.registry.wrap_all not available; skipping action interception.")


async def run_browser_task(task: str, ctx: ExecutionContext) -> Any:
    """
    High-level helper to run a browser-use agent with AgentZ defaults.
    """
    from browser_use import Agent, Controller
    from agentz.core.llm import get_llm

    llm = get_llm()
    controller = Controller()
    attach_interceptor(controller, ctx)

    agent = Agent(
        task=task,
        llm=llm,
        controller=controller
    )

    return await run_with_healing(agent, ctx)


async def run_with_healing(
    agent: Agent, 
    ctx: ExecutionContext, 
    max_heals: int = 1
) -> Any:
    """
    Runs a browser-use agent and attempts self-healing on failure.
    """
    try:
        history = await agent.run()
    except Exception as e:
        logger.error(f"Agent crashed during run: {e}")
        # If it crashed, we might not have history, so we can't heal easily 
        # without state. But let's at least try to report.
        raise

    # Check if the last step failed
    last_step = history.history[-1] if history.history else None
    has_error = False
    error_msg = ""

    if last_step and last_step.result:
        for r in last_step.result:
            if r.error:
                has_error = True
                error_msg = r.error
                break
    
    # If no explicit error but task not finished
    if not has_error and history.is_done() is False:
        has_error = True
        error_msg = "Task reached completion limit without success."

    if has_error and max_heals > 0:
        ctx.step(f"Healer: Detecting failure - {error_msg}")
        
        from agentz.core.healer import Healer
        healer = Healer()
        
        # Capture context
        screenshot = history.screenshots()[-1] if history.screenshots() else None
        history_summary = "\n".join([str(h) for h in history.history[-5:]]) # Last 5 steps
        
        recovery_prompt = healer.suggest_recovery(
            task=agent.task,
            error=error_msg,
            screenshot_b64=screenshot,
            history_summary=history_summary
        )
        
        ctx.step(f"Healer: Suggested recovery prompt: {recovery_prompt}")
        
        if ctx.step("Healer: Apply recovery prompt and retry?"):
            from browser_use import Agent as BrowserAgent
            # We recreate the agent with the new task. 
            # Note: We reuse the controller and browser if possible.
            new_agent = BrowserAgent(
                task=f"ORIGINAL TASK: {agent.task}\n\nRECOVERY INSTRUCTIONS: {recovery_prompt}",
                llm=agent.llm,
                controller=agent.controller,
                browser=agent.browser,
            )
            return await run_with_healing(new_agent, ctx, max_heals - 1)
        else:
            ctx.step("Healer: Recovery aborted by user.")

    # Record usage in ctx
    try:
        usage = {
            "total_tokens": history.total_tokens(),
            "input_tokens": history.total_input_tokens(),
            "output_tokens": history.total_output_tokens(),
        }
        cost = getattr(history, "total_cost", lambda: 0.0)() if hasattr(history, "total_cost") else 0.0
        ctx.set_usage(usage, cost)
    except Exception:
        pass

    return history
