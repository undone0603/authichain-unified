#!/usr/bin/env python3
"""Minimal LLM connectivity reproducer for LimitProofLLM waterfall.

Loads project .env, probes each provider factory, then tries get_llm().invoke.
Secrets in errors are masked (first4...last4 for long tokens).
"""
from __future__ import annotations

import os
import re
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

# Prefer repo-root .env (credentials.py also loads this)
for env_path in (ROOT / ".env", ROOT / ".env.local"):
    if env_path.exists():
        load_dotenv(env_path, override=False)
        print(f"loaded_env={env_path}")


def mask(text: str) -> str:
    """Mask likely secrets in error strings."""
    s = str(text)
    # long token-like substrings
    def _m(m: re.Match) -> str:
        v = m.group(0)
        if len(v) <= 8:
            return "***"
        return f"{v[:4]}...{v[-4:]}"

    s = re.sub(r"(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])", _m, s)
    s = re.sub(r"(sk-[A-Za-z0-9_-]+)", lambda m: mask_key(m.group(1)), s)
    s = re.sub(r"(AIza[A-Za-z0-9_-]+)", lambda m: mask_key(m.group(1)), s)
    return s[:500]


def mask_key(v: str | None) -> str:
    if not v:
        return "NOT SET"
    v = v.strip()
    if len(v) <= 8:
        return f"SET len={len(v)}"
    return f"SET {v[:4]}...{v[-4:]} (len={len(v)})"


TRACKED = [
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
    "CEREBRAS_API_KEY",
    "DEEPSEEK_API_KEY",
    "ANTHROPIC_API_KEY",
    "LOCAL_MODEL_URL",
    "LOCAL_MODEL_ID",
    "LOCAL_MODEL_ID_FALLBACK",
    "OLLAMA_HOST",
    "OLLAMA_MODEL",
    "OLLAMA_API_KEY",
]


def main() -> int:
    print("=== env presence (masked) ===")
    for k in TRACKED:
        print(f"  {k}: {mask_key(os.environ.get(k))}")

    from agentz.core.llm import LimitProofLLM, get_llm, get_provider_health, _PROVIDER_HEALTH

    llm_wrap = LimitProofLLM(temperature=0.0)
    print("\n=== per-provider probe (factory + invoke Hello world) ===")
    results = []
    for name, factory in llm_wrap.providers:
        status = "unknown"
        detail = ""
        try:
            client = factory()
            status = "built"
            res = client.invoke("Hello world")
            content = getattr(res, "content", res)
            status = "succeeded"
            detail = mask(str(content)[:200])
            print(f"  {name}: SUCCEEDED -> {detail}")
            results.append((name, status, detail))
            # stop probing further successes for speed? keep going for full map
        except Exception as e:
            status = "failed"
            detail = mask(f"{type(e).__name__}: {e}")
            print(f"  {name}: FAILED -> {detail}")
            results.append((name, status, detail))

    print("\n=== get_llm().invoke('Hello world') waterfall ===")
    # reset health so waterfall is not poisoned by probe marks
    _PROVIDER_HEALTH.clear()
    try:
        out = get_llm().invoke("Hello world")
        content = getattr(out, "content", out)
        print(f"  WATERFALL SUCCEEDED: {mask(str(content)[:300])}")
        print(f"  provider_health={get_provider_health()}")
        return 0
    except Exception as e:
        print(f"  WATERFALL FAILED: {mask(f'{type(e).__name__}: {e}')}")
        print(f"  provider_health={get_provider_health()}")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
