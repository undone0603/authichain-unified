"""
agentz.workflows.handlers.linkedin_outreach
-------------------------------------------
StrainChain outreach to Michigan cannabis decision-makers via
LinkedIn Sales Navigator. Uses Bitcoin-inscribed product certifications
($299) as the value-prop hook.

Rate-limit guard: 18 invites/day max. Logs all sent contact IDs to
Supabase strainchain_outreach_log to prevent double-touching.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import httpx

from agentz.core.credentials import get, get_or_placeholder
from agentz.core.modes import ExecutionContext, Mode

DAILY_INVITE_CAP = 18

SEARCH_URL = (
    "https://www.linkedin.com/sales/search/people"
    "?query=(filters%3AList((type%3ATITLE%2Cvalues%3AList((id%3Acompliance)%2C(id%3Aoperations)%2C(id%3ACOO)))"
    "%2C(type%3AINDUSTRY%2Cvalues%3AList((id%3A1606)))"
    "%2C(type%3AGEOGRAPHY%2Cvalues%3AList((id%3A102537892)))))"
)

FIRST_TOUCH = """\
Hi {first_name},

Saw you're running ops at {company} - quick context: I built StrainChain,
a compliance middleware that stamps each batch with a Bitcoin-inscribed
certificate ($299/cert, no monthly). It plugs into Metrc and creates
an immutable audit trail regulators can verify in seconds.

Happy to send a 90-second demo video - no call needed. Worth a look?

- Zac
"""


def run(ctx: ExecutionContext) -> str:
    sent_today = ctx.step(
        "query Supabase: count invites sent today",
        action=_count_sent_today,
    ) or 0

    remaining = DAILY_INVITE_CAP - sent_today
    if remaining <= 0:
        return f"daily cap reached ({sent_today}/{DAILY_INVITE_CAP})"

    ctx.step(f"daily budget: {remaining} invites remaining")

    if ctx.mode == Mode.DRY_RUN:
        ctx.step(f"would open Sales Nav search")
        ctx.step(f"would send up to {remaining} connection requests with first-touch message")
        return f"dry-run: would send up to {remaining}"

    return asyncio.run(_run_browser_task(ctx, remaining))


async def _run_browser_task(ctx: ExecutionContext, budget: int) -> str:
    try:
        from browser_use import Agent, Controller
        from agentz.core.llm import get_llm
        from agentz.core.browser import attach_interceptor, run_with_healing
        from agentz.core.session_manager import get_browser_with_session
    except ImportError as e:
        raise RuntimeError("browser-use stack not installed") from e

    task = f"""\
Open this URL: {SEARCH_URL}

For up to {budget} prospects on the first results page (skip any
already in my connections):

  1. Open the prospect's profile.
  2. Extract: first_name, last_name, company, profile_url.
  3. Click "Connect" -> "Add a note".
  4. Paste this message (substitute {{first_name}} and {{company}}):

{FIRST_TOUCH}

  5. Send.
  6. Log the prospect details (you'll output them as JSON at the end).

Output a JSON array of all sent prospects when finished.
Do NOT exceed {budget} sends.
"""
    llm = get_llm(model="llama3.2", temperature=0.1)
    controller = Controller()
    attach_interceptor(controller, ctx)
    browser = get_browser_with_session(["linkedin_session"])
    agent = Agent(task=task, llm=llm, controller=controller, browser=browser)
    history = await run_with_healing(agent, ctx)

    sent = _parse_sent_prospects(history)

    # Log to Supabase
    if sent:
        ctx.step(f"log {len(sent)} sent prospects to Supabase",
                 action=lambda: _log_to_supabase(sent))

    return f"sent {len(sent)} invites (budget was {budget})"


def _count_sent_today() -> int:
    url = get("supabase_url") + "/rest/v1/strainchain_outreach_log"
    headers = {
        "apikey":        get("supabase_anon"),
        "Authorization": f"Bearer {get('supabase_anon')}",
    }
    today = datetime.now(timezone.utc).date().isoformat()
    r = httpx.get(
        url,
        headers={**headers, "Prefer": "count=exact"},
        params={"sent_at": f"gte.{today}", "select": "id"},
        timeout=15.0,
    )
    if r.status_code != 200:
        return 0
    return int(r.headers.get("Content-Range", "0/0").split("/")[-1])


def _parse_sent_prospects(history) -> list[dict]:
    import json, re
    text = str(history)
    match = re.search(r"\[\s*\{.*?\}\s*\]", text, re.DOTALL)
    if not match:
        return []
    try:
        return json.loads(match.group(0))
    except Exception:
        return []


def _log_to_supabase(prospects: list[dict]) -> bool:
    url = get("supabase_url") + "/rest/v1/strainchain_outreach_log"
    headers = {
        "apikey":        get("supabase_anon"),
        "Authorization": f"Bearer {get('supabase_anon')}",
        "Content-Type":  "application/json",
        "Prefer":        "return=minimal",
    }
    now = datetime.now(timezone.utc).isoformat()
    rows = [{**p, "sent_at": now, "campaign": "strainchain_mi_q2_26"} for p in prospects]
    r = httpx.post(url, headers=headers, json=rows, timeout=20.0)
    return r.status_code in (200, 201, 204)
