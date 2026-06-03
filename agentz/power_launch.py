"""power_launch_all — launch every platform agent sequentially or in parallel."""

from __future__ import annotations

import concurrent.futures
import json
import sys
import time
from typing import Literal

from .agents.base import AgentResult, BaseAgent
from .agents.pipeline import ALL_AGENTS
from .lm_studio import LMStudioClient

Mode = Literal["auto", "confirm", "dry-run"]


def _run_agent(cls: type[BaseAgent], client: LMStudioClient) -> AgentResult:
    return cls(client).run()


def power_launch_all(
    *,
    mode: Mode = "auto",
    parallel: bool = True,
    lm_base_url: str = "http://localhost:1234/v1",
    verbose: bool = True,
) -> list[AgentResult]:
    """
    Launch all registered platform agents.

    Parameters
    ----------
    mode      : "auto"     — run every agent without human confirmation (default)
                "confirm"  — prompt before each agent
                "dry-run"  — list agents only; no LLM calls
    parallel  : run agents concurrently when mode is "auto"
    lm_base_url: LM Studio OpenAI-compatible base URL
    verbose   : print progress to stdout
    """
    client = LMStudioClient(base_url=lm_base_url)

    if verbose:
        _print_banner()
        print(f"  Mode      : {mode}")
        print(f"  LM Studio : {lm_base_url}")
        print(f"  Agents    : {len(ALL_AGENTS)}")
        print()

    # ── health-check ────────────────────────────────────────────────────────
    if mode != "dry-run":
        if verbose:
            print("Checking LM Studio connection … ", end="", flush=True)
        alive = client.health_check()
        if not alive:
            _fail(
                f"LM Studio is not reachable at {lm_base_url}.\n"
                "Start LM Studio, load a model, and enable the local server (port 1234)."
            )
        if verbose:
            models = client.list_models()
            model_label = models[0] if models else "unknown"
            client.model = model_label
            print(f"OK  (model: {model_label})")
            print()

    # ── dry-run ─────────────────────────────────────────────────────────────
    if mode == "dry-run":
        if verbose:
            print("Registered agents (dry-run — no LLM calls):")
            for cls in ALL_AGENTS:
                print(f"  • {cls.name}")
        return []

    # ── launch ──────────────────────────────────────────────────────────────
    results: list[AgentResult] = []
    wall_start = time.monotonic()

    if mode == "auto" and parallel:
        if verbose:
            print(f"Launching {len(ALL_AGENTS)} agents in parallel (staggered) …\n")
        
        # Reduce max_workers to prevent immediate rate limit overload
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            futures = {}
            for cls in ALL_AGENTS:
                # Add a small delay between submitting tasks to stagger API hits
                time.sleep(1.5)
                futures[pool.submit(_run_agent, cls, client)] = cls
                
            for future in concurrent.futures.as_completed(futures):
                result = future.result()
                results.append(result)
                if verbose:
                    _print_result(result)
    else:
        for cls in ALL_AGENTS:
            if mode == "confirm":
                answer = input(f"Run agent '{cls.name}'? [y/N] ").strip().lower()
                if answer != "y":
                    if verbose:
                        print(f"  Skipped: {cls.name}")
                    continue
            if verbose:
                print(f"  Running {cls.name} … ", end="", flush=True)
            result = _run_agent(cls, client)
            results.append(result)
            if verbose:
                _print_result(result)

    wall_ms = int((time.monotonic() - wall_start) * 1000)
    ok_count = sum(1 for r in results if r.ok)
    fail_count = len(results) - ok_count

    if verbose:
        print()
        print("─" * 60)
        print(f"  Completed: {len(results)} agents in {wall_ms}ms")
        print(f"  ✓ OK: {ok_count}   ✗ Failed: {fail_count}")
        print("─" * 60)

    return results


def _print_banner() -> None:
    print("=" * 60)
    print("   AgentZ — AuthiChain Power Launch")
    print("=" * 60)


def _print_result(result: AgentResult) -> None:
    if result.ok:
        preview = result.output[:120].replace("\n", " ")
        print(f"  ✓ {result.name} ({result.duration_ms}ms)")
        if preview:
            print(f"    {preview}…" if len(result.output) > 120 else f"    {preview}")
    else:
        print(f"  ✗ {result.name} ({result.duration_ms}ms) — {result.error}")


def _fail(msg: str) -> None:
    print(f"\n[ERROR] {msg}", file=sys.stderr)
    sys.exit(1)
