"""Goal placeholder: multiply one approved post into four brand surfaces.

registry.yaml workflow id: authichain_content_multiplication
Dry-run prints the plan. Auto writes planned rows and does not publish.
Ported from deleted services/agentz/core/multiplier.py @ 50429c5a.
"""
from __future__ import annotations

from agentz.core.modes import ExecutionContext, Mode

BRANDS = ("authichain.com", "qron.space", "strainchain.io", "govchain.us")


def run(ctx: ExecutionContext) -> str:
    params = ctx.parameters or {}
    source = str(params.get("source") or params.get("text") or "").strip()
    ctx.step("load latest approved source post")
    ctx.step(f"draft variants for {', '.join(BRANDS)}")
    ctx.step("write drafts table (not publish)")
    ctx.step("enqueue human review if auto")

    if ctx.mode == Mode.DRY_RUN:
        preview = (source[:80] + "…") if len(source) > 80 else (source or "(no source in payload)")
        ctx.step(f"would draft from: {preview}")
        return "dry-run: content_multiplier plan rendered — no post published"

    ctx.step("record workflow_runs=planned; publishers not bound")
    return "planned: drafts queued for review (publish publishers not bound yet)"
