"""How AgentZ picks and performs one Taskmarket worker task.

Money on this board is escrowed by the requester and released only when
that requester accepts a submission. Submitting, claiming, or pitching
does not pay. Base (chain 8453) rewards are USDC in 6-decimal atomic
units. Other chains are not priced as USDC.

This module never signs, never stakes, and never posts a write. The CLI
holds the key. AgentZ prints the next command.
"""

from __future__ import annotations

import json
import urllib.request
from datetime import datetime, timezone
from typing import Any, Callable

API = "https://api.taskmarket.dev"
USDC_DECIMALS = 6
BASE_CHAIN_ID = 8453

# Exact EIP-191 strings from the Taskmarket raw API. A missing "market:"
# segment is refused by the server.
SIGNATURE_BY_ACTION = {
    "claim": "taskmarket:market:claim:{task_id}",
    "submit": "taskmarket:market:submit:{task_id}",
    "pitch": "taskmarket:market:pitch:{task_id}",
}

REFUSES = (
    "Do not call task accept, reject-submission, or cancel. Those are requester actions and the accept call spends 0.001 of the payment token.",
    "Do not pass --yes on a claim. That posts the stake.",
    "Do not enter auction tasks or tasks that ask for an exploit, a proof of concept, junk delivery, or a reject-fee demonstration.",
    "Do not print or copy a private key into the workflow, the checkpoint, or the deliverable.",
    "Do not send eth_sendRawTransaction. The Taskmarket CLI signs the EIP-191 message.",
    "A submission is not a payout and it is not Stripe revenue. classifyRevenue stays on livemode Stripe subscriptions, payouts, and charges.",
)

_SKIP_TEXT = (
    "exploit",
    "cap-snipe",
    "submit junk",
    "proof of concept",
    "proof-of-concept",
    "bug bounty",
    "vulnerability",
    "reject fee",
)


def reward_usdc(task: dict[str, Any]) -> float | None:
    """Return Base USDC for a task, or None when the unit is not Base USDC."""
    try:
        chain_id = int(task.get("chainId"))
        atomic = int(task.get("reward") or 0)
    except (TypeError, ValueError):
        return None
    if chain_id != BASE_CHAIN_ID or atomic <= 0:
        return None
    return atomic / 10**USDC_DECIMALS


def _parse_time(value: Any) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    text = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _hours_left(task: dict[str, Any], now: datetime) -> float | None:
    expiry = _parse_time(task.get("expiryTime"))
    if expiry is None:
        return None
    return (expiry - now).total_seconds() / 3600


def _blob(task: dict[str, Any]) -> str:
    tags = " ".join(str(tag) for tag in (task.get("tags") or []))
    return f"{task.get('description') or ''}\n{tags}".lower()


def _blocked_reason(task: dict[str, Any], now: datetime, allow_stake: bool) -> str | None:
    status = str(task.get("status") or "")
    if status != "open":
        return f"status {status or 'missing'}"
    if task.get("claimedBy"):
        return "already claimed"
    hours = _hours_left(task, now)
    if hours is None:
        return "missing expiry"
    if hours <= 0:
        return "expired"
    mode = str(task.get("mode") or "")
    if mode == "auction":
        return "auction"
    if mode not in {"bounty", "claim", "pitch"}:
        return f"mode {mode or 'missing'}"
    blob = _blob(task)
    if any(marker in blob for marker in _SKIP_TEXT):
        return "unsafe task"
    if task.get("stakeRequired") and not allow_stake:
        return "stake required"
    submissions = int(task.get("submissionCount") or 0)
    if hours < 1 and submissions >= 20:
        return "crowded deadline"
    if reward_usdc(task) is None:
        return "not base usdc"
    return None


def _action_for(task: dict[str, Any]) -> str:
    mode = str(task.get("mode") or "")
    if mode == "claim":
        return "claim"
    if mode == "pitch":
        return "pitch"
    return "submit"


def _blockers(task: dict[str, Any]) -> list[str]:
    description = task.get("description") or ""
    lowered = description.lower()
    missing: list[str] = []
    if "public" in lowered and ("link" in lowered or "audit page" in lowered or "blog" in lowered):
        missing.append("Deliverable must include a public URL the requester can open.")
    if "deliver one zip" in lowered or "deliverable" in lowered:
        missing.append("Finish the named files before submit. Do not submit a placeholder.")
    return missing


def _commands(action: str, task_id: str) -> list[str]:
    show = f"curl -fsS {API}/api/tasks/{task_id}"
    if action == "claim":
        return [
            "taskmarket legal status",
            show,
            f"taskmarket task claim {task_id}",
        ]
    if action == "pitch":
        return [
            "taskmarket legal status",
            show,
            f"taskmarket task pitch {task_id} --file pitch.md",
        ]
    return [
        "taskmarket legal status",
        show,
        f"taskmarket task submit {task_id} --file deliverable.md",
    ]


def select_task(
    tasks: list[dict[str, Any]],
    *,
    now: datetime | None = None,
    allow_stake: bool = False,
) -> dict[str, Any]:
    """Pick one open Base-USDC worker task, or wait.

    Higher USDC wins. Time left and a thinner submission pile break ties
    only by score, so a large prize that expires inside an hour under a
    pile of submissions is dropped before scoring.
    """
    clock = now or datetime.now(timezone.utc)
    if clock.tzinfo is None:
        clock = clock.replace(tzinfo=timezone.utc)
    best: dict[str, Any] | None = None
    best_score = -1.0
    skipped = 0
    for task in tasks:
        if not isinstance(task, dict):
            skipped += 1
            continue
        reason = _blocked_reason(task, clock, allow_stake)
        if reason:
            skipped += 1
            continue
        usd = reward_usdc(task) or 0.0
        hours = _hours_left(task, clock) or 0.0
        submissions = int(task.get("submissionCount") or 0)
        score = usd * min(hours, 72) / 72 / (1 + submissions)
        if score > best_score:
            best = task
            best_score = score

    if best is None:
        return {
            "action": "wait",
            "taskId": None,
            "referenceCode": None,
            "chainId": None,
            "rewardAtomic": None,
            "rewardUsdc": None,
            "signatureMessage": None,
            "commands": [],
            "reason": "No open unclaimed Base USDC task passed the worker filter.",
            "refuses": list(REFUSES),
            "blockers": [],
            "skipped": skipped,
            "signs": False,
            "stakes": False,
        }

    action = _action_for(best)
    task_id = str(best.get("id") or "")
    usd = reward_usdc(best)
    return {
        "action": action,
        "taskId": task_id,
        "referenceCode": best.get("referenceCode"),
        "chainId": BASE_CHAIN_ID,
        "rewardAtomic": str(best.get("reward")),
        "rewardUsdc": usd,
        "signatureMessage": SIGNATURE_BY_ACTION[action].format(task_id=task_id),
        "commands": _commands(action, task_id),
        "reason": (
            f"{action} {best.get('referenceCode')} for {usd} USDC on Base. "
            "Re-fetch the task immediately before the CLI write. "
            "Payment happens only after the requester accepts."
        ),
        "refuses": list(REFUSES),
        "blockers": _blockers(best),
        "skipped": skipped,
        "signs": False,
        "stakes": False,
    }


def fetch_open_tasks(
    get_json: Callable[[str], Any] | None = None,
    *,
    max_pages: int = 5,
) -> list[dict[str, Any]]:
    """Follow status=open pages. Stops on hasMore false or max_pages."""
    reader = get_json or _http_json
    tasks: list[dict[str, Any]] = []
    cursor: str | None = None
    for _ in range(max_pages):
        url = f"{API}/api/tasks?status=open"
        if cursor:
            url = f"{url}&cursor={cursor}"
        page = reader(url)
        if not isinstance(page, dict):
            break
        batch = page.get("tasks") or []
        if isinstance(batch, list):
            tasks.extend(item for item in batch if isinstance(item, dict))
        if not page.get("hasMore") or not page.get("nextCursor"):
            break
        cursor = str(page["nextCursor"])
    return tasks


def _http_json(url: str) -> Any:
    request = urllib.request.Request(url, headers={"User-Agent": "authichain-probe"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))
