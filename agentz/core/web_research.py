"""Read-only research: TinyFish search, then read the top results through the
network-isolated browser (agentz.core.public_navigation). Collects and cites;
it does not summarize. Page text is untrusted third-party content, never
instructions. Used by POST /agentz/research and `@agentz research`.
"""
from __future__ import annotations

import asyncio
import json
import subprocess
from typing import Any, Callable

MAX_SOURCES = 5
SNAPSHOT_CHARS = 6000


def search_results(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Results from a TinyFish search response: structured_content first, then
    JSON carried in text blocks. Only https URLs are kept."""
    results: list[dict[str, Any]] = []
    sc = raw.get("structured_content")
    if isinstance(sc, dict) and isinstance(sc.get("results"), list):
        results = [r for r in sc["results"] if isinstance(r, dict)]
    if not results:
        for block in raw.get("content") or []:
            try:
                parsed = json.loads(block)
            except (TypeError, ValueError):
                continue
            if isinstance(parsed, dict) and isinstance(parsed.get("results"), list):
                results += [r for r in parsed["results"] if isinstance(r, dict)]
    seen, out = set(), []
    for r in results:
        url = str(r.get("url", ""))
        if url.startswith("https://") and url not in seen:
            seen.add(url)
            out.append(r)
    return out


def _text(snapshot: str) -> str:
    """Readable page text from a browser snapshot. Keeps every non-empty line:
    agent-browser and Playwright ariaSnapshot formats differ (`- StaticText "x"`
    vs `- paragraph: x`), so filtering by node type would drop body text."""
    return "\n".join(line.rstrip() for line in snapshot.splitlines() if line.strip())


def research(question: str, n: int = 3, *,
             search: Callable[[str], dict[str, Any]] | None = None,
             navigate: Callable[[str], dict[str, Any]] | None = None) -> dict[str, Any]:
    question = (question or "").strip()
    if not question or len(question) > 500:
        raise ValueError("question must be 1-500 characters")
    if not isinstance(n, int) or not 1 <= n <= MAX_SOURCES:
        raise ValueError(f"n must be 1-{MAX_SOURCES}")
    if search is None:
        from agentz.integrations.tinyfish_mcp import call_tinyfish

        def search(q: str) -> dict[str, Any]:
            return asyncio.run(call_tinyfish("search", [q]))
    if navigate is None:
        from agentz.core.public_navigation import navigate_public as navigate

    raw = search(question)
    if not raw.get("ok", True):
        raise RuntimeError("search failed")
    sources = []
    for r in search_results(raw)[:n]:
        item = {"url": r["url"], "title": r.get("title") or r["url"],
                "snippet": r.get("snippet") or "", "date": r.get("date")}
        try:
            text = _text(navigate(r["url"]).get("snapshot", ""))
            item["text"] = text[:SNAPSHOT_CHARS]
            item["truncated"] = len(text) > SNAPSHOT_CHARS
        except (ValueError, RuntimeError, OSError, PermissionError, subprocess.TimeoutExpired) as exc:
            item["error"] = f"{type(exc).__name__}: {exc}"[:200]
        sources.append(item)
    return {"question": question, "sources": sources,
            "read": sum(1 for s in sources if "text" in s), "trusted": False}
