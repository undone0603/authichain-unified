"""
agentz.core.resilience
----------------------
Robust agent execution loop with built-in loop detection, stagnation 
management, and error recovery. Adapted from Sovereign Agent blueprints.
"""
from __future__ import annotations
import time
import logging
import asyncio
from typing import Any, Callable, List, Optional, Tuple, TYPE_CHECKING

if TYPE_CHECKING:
    from agentz.core.modes import ExecutionContext

logger = logging.getLogger("agentz.resilience")

class ActionError(Exception):
    pass

class Action:
    """
    Base action interface. Subclass or wrap callables to implement actions.
    Implement `run(context) -> result` where result is any object indicating progress.
    """
    def __init__(self, name: str):
        self.name = name

    async def run(self, context: dict) -> Any:
        raise NotImplementedError("Action.run must be implemented")

class CallableAction(Action):
    def __init__(self, fn: Callable[[dict], Any], name: Optional[str] = None):
        super().__init__(name or getattr(fn, "__name__", "callable_action"))
        if not callable(fn):
            raise TypeError("fn must be callable")
        self.fn = fn

    async def run(self, context: dict) -> Any:
        if asyncio.iscoroutinefunction(self.fn):
            return await self.fn(context)
        return self.fn(context)

class BrowserAction(Action):
    """
    Wraps a browser-use task as a resilient action.
    """
    def __init__(self, task: str, name: Optional[str] = None):
        super().__init__(name or f"browser_task:{task[:30]}...")
        self.task = task

    async def run(self, context: dict) -> Any:
        from agentz.core.browser import _execute_raw_browser_task
        # ExecutionContext should be in context
        ctx = context.get("ctx")
        return await _execute_raw_browser_task(self.task, ctx)

class RobustAgent:
    def __init__(
        self,
        max_steps: int = 10,
        max_retries_per_action: int = 2,
        stagnation_threshold: int = 3,
        repetition_threshold: int = 2,
        step_delay: float = 1.0,
    ):
        self.max_steps = max_steps
        self.max_retries_per_action = max_retries_per_action
        self.stagnation_threshold = stagnation_threshold
        self.repetition_threshold = repetition_threshold
        self.step_delay = step_delay

        self.history: List[Tuple[str, Any]] = []  # (action_name, result)
        self.progress_counter = 0
        self.repetition_counter = 0

    def _is_repetition(self, action_name: str) -> bool:
        # Count how many times the last action_name appears in recent history
        recent = [a for a, _ in self.history[-self.repetition_threshold:]]
        return recent.count(action_name) >= self.repetition_threshold

    def _inject_exploration_nudge(self, ctx: ExecutionContext, step: int):
        ctx.step(f"📋 Exploration nudge injected after {step} steps without a plan")

    def _inject_loop_detection_nudge(self, ctx: ExecutionContext, repetition: int, stagnation: int):
        ctx.step(f"🔁 Loop detection nudge injected (repetition={repetition}, stagnation={stagnation})")

    async def run(self, goal: str, initial_plan: List[Action], ctx: ExecutionContext, initial_context: Optional[dict] = None) -> dict:
        context = dict(initial_context or {})
        plan = list(initial_plan)
        
        if not plan:
            logger.warning("No plan provided to RobustAgent.")
            self._inject_exploration_nudge(ctx, 0)
            return context

        step = 0
        last_progress_snapshot = None
        
        while step < self.max_steps and plan:
            action = plan.pop(0)
            action_name = getattr(action, "name", action.__class__.__name__)
            step += 1
            
            ctx.step(f"📍 Step {step}: executing action '{action_name}'")

            # Type-safety: ensure action is Action instance
            if not isinstance(action, Action):
                if callable(action):
                    action = CallableAction(action, name=str(getattr(action, "__name__", "wrapped_callable")))
                    action_name = action.name
                else:
                    logger.error(f"Invalid action type: {type(action)}. Skipping.")
                    continue

            # Loop detection: repetition
            if self._is_repetition(action_name):
                self.repetition_counter += 1
                logger.warning(f"Detected repetition of action '{action_name}' (count={self.repetition_counter}).")
            else:
                self.repetition_counter = 0

            # Execute with retries
            attempt = 0
            success = False
            while attempt < self.max_retries_per_action and not success:
                attempt += 1
                try:
                    result = await action.run(context)
                    logger.info(f"Action '{action_name}' succeeded (attempt {attempt}).")
                    self.history.append((action_name, result))
                    success = True
                except ActionError as ae:
                    logger.warning(f"Action '{action_name}' failed with ActionError: {ae} (attempt {attempt})")
                    if attempt >= self.max_retries_per_action:
                        logger.error(f"Max retries reached for action '{action_name}'. Continuing.")
                except Exception as e:
                    logger.exception(f"Action '{action_name}' raised unexpected exception: {e}")
                    # If it's a type error like "'str' object has no attribute 'action'", handle gracefully
                    if isinstance(e, AttributeError) and "action" in str(e):
                        logger.error("Framework type error detected. Attempting recovery...")
                        # In the real codebase, we fixed this via LLMProxy, but here we can 
                        # just skip or try to re-wrap.
                        break
                        
                    if attempt >= self.max_retries_per_action:
                        logger.error(f"Max retries reached for action '{action_name}' after exception.")
                
                if self.step_delay > 0:
                    await asyncio.sleep(self.step_delay)

            # Progress detection: compare snapshots of context
            # We use a simple hash of the context to detect change
            snapshot = repr(sorted([(k, str(v)) for k, v in context.items()]))
            if snapshot != last_progress_snapshot:
                self.progress_counter = 0
                last_progress_snapshot = snapshot
            else:
                self.progress_counter += 1
                logger.info(f"No progress detected after action '{action_name}' (stagnation={self.progress_counter}).")

            # Stagnation -> Exploration nudge
            if self.progress_counter >= self.stagnation_threshold:
                self._inject_exploration_nudge(ctx, step)
                # Potential: add an 'exploratory' step if we had an LLM planner here
                self.progress_counter = 0 

            # Repetition -> Loop detection nudge
            if self.repetition_counter >= self.repetition_threshold:
                self._inject_loop_detection_nudge(ctx, self.repetition_counter, self.progress_counter)
                logger.error("Persistent repetition detected. Stopping robust loop.")
                break

        ctx.step(f"Robust loop finished after {step} steps. History: {len(self.history)}")
        return context
