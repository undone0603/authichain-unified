"""
Standalone power-launch script that bypasses the LM Studio health check
and routes all LLM calls through the LimitProofLLM waterfall fallover chain.
"""

from __future__ import annotations

import concurrent.futures
import os
import sys
import time
from typing import Any

# ── patch LMStudioClient to use waterfall LLM ──────────────────────────────

from agentz.lm_studio import LMStudioClient
from agentz.core.llm import LimitProofLLM
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

_waterfall = LimitProofLLM(temperature=0.3)


def _chat_via_waterfall(
    self: Any,
    messages: list[dict[str, str]],
    *,
    max_tokens: int = 1024,
    temperature: float = 0.3,
) -> str:
    lc_messages = []
    for m in messages:
        role, content = m.get("role", "user"), m.get("content", "")
        if role == "system":
            lc_messages.append(SystemMessage(content=content))
        elif role == "assistant":
            lc_messages.append(AIMessage(content=content))
        else:
            lc_messages.append(HumanMessage(content=content))
    res = _waterfall.invoke(lc_messages)
    return getattr(res, "content", str(res))


LMStudioClient.chat = _chat_via_waterfall  # type: ignore[method-assign]

# ── run ─────────────────────────────────────────────────────────────────────

from agentz.agents.base import AgentResult, BaseAgent
from agentz.agents.pipeline import ALL_AGENTS

BANNER = "=" * 60

def _run_agent(cls: type[BaseAgent]) -> AgentResult:
    client = LMStudioClient()
    return cls(client).run()

def _print_result(r: AgentResult) -> None:
    if r.ok:
        preview = r.output[:140].replace("\n", " ")
        print(f"  ✓ {r.name} ({r.duration_ms}ms)")
        if preview:
            suffix = "…" if len(r.output) > 140 else ""
            print(f"    {preview}{suffix}")
    else:
        print(f"  ✗ {r.name} ({r.duration_ms}ms) — {r.error}")

def main() -> None:
    print(BANNER)
    print("   AgentZ — AuthiChain Power Launch (Waterfall LLM)")
    print(BANNER)
    print(f"  Agents : {len(ALL_AGENTS)}")
    print(f"  LLM    : LimitProofLLM waterfall (GPT-4o → Gemini → … → Ollama)")
    print()

    wall_start = time.monotonic()
    results: list[AgentResult] = []

    print(f"Launching {len(ALL_AGENTS)} agents in parallel…\n")
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(_run_agent, cls): cls for cls in ALL_AGENTS}
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            results.append(result)
            _print_result(result)

    wall_ms = int((time.monotonic() - wall_start) * 1000)
    ok_count = sum(1 for r in results if r.ok)
    fail_count = len(results) - ok_count

    print()
    print("─" * 60)
    print(f"  Completed : {len(results)} agents in {wall_ms}ms")
    print(f"  ✓ OK: {ok_count}   ✗ Failed: {fail_count}")
    print("─" * 60)

    # Exit non-zero if any agent failed
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()
