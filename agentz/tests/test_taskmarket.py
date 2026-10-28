"""AgentZ Taskmarket picker. Drives select_task and the workflow handler."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from agentz.core.modes import ExecutionContext, Mode
from agentz.core.taskmarket import fetch_open_tasks, reward_usdc, select_task
from agentz.workflows.handlers.taskmarket_cycle import run

NOW = datetime(2026, 10, 28, 22, 9, tzinfo=timezone.utc)


def _task(**overrides):
    base = {
        "id": "0xabc",
        "referenceCode": "TSK-TEST",
        "chainId": 8453,
        "reward": "1000000",
        "status": "open",
        "mode": "bounty",
        "expiryTime": "2026-10-31T14:33:50.538Z",
        "claimedBy": None,
        "stakeRequired": False,
        "submissionCount": 2,
        "description": "Write a short note. Deliver one markdown file.",
        "tags": ["writing"],
    }
    base.update(overrides)
    return base


def test_base_reward_is_six_decimals_and_other_chains_are_not_usdc():
    assert reward_usdc(_task(reward="2700000")) == 2.7
    assert reward_usdc(_task(chainId=4217, reward="100000000")) is None


def test_exploit_auction_and_bug_bounty_are_not_selected():
    tasks = [
        _task(
            id="0xexploit",
            referenceCode="TSK-EXPLOIT",
            mode="auction",
            description="Live exploit demo: Dutch auction cap-snipe. Submit junk.",
            tags=["exploit", "demo"],
        ),
        _task(
            id="0xbounty",
            referenceCode="TSK-BUG",
            description="TaskMarket Smart Contract Bug Bounty. Highest-severity proof of concept.",
            reward="5000000",
        ),
    ]
    plan = select_task(tasks, now=NOW)
    assert plan["action"] == "wait"
    assert plan["signs"] is False
    assert plan["stakes"] is False


def test_claimed_expired_and_staked_tasks_lose_to_an_open_bounty():
    tasks = [
        _task(id="0xclaimed", status="open", mode="claim", claimedBy="0xother", reward="9000000"),
        _task(id="0xpast", expiryTime="2026-10-28T21:00:00.000Z", reward="9000000"),
        _task(
            id="0xstake",
            mode="claim",
            stakeRequired=True,
            reward="9000000",
            description="Claim this funded task. Deliver the note.",
        ),
        _task(id="0xok", referenceCode="TSK-OK", reward="2000000", submissionCount=1),
    ]
    plan = select_task(tasks, now=NOW)
    assert plan["action"] == "submit"
    assert plan["taskId"] == "0xok"
    assert plan["rewardUsdc"] == 2.0
    assert plan["signatureMessage"] == "taskmarket:market:submit:0xok"
    assert "taskmarket task accept" not in " ".join(plan["commands"])
    assert any("legal status" in command for command in plan["commands"])


def test_unstaked_claim_uses_the_market_claim_message():
    plan = select_task(
        [
            _task(
                id="0xclaim",
                referenceCode="TSK-CLAIM",
                mode="claim",
                reward="2700000",
                submissionCount=0,
                description="Normalize the csv. Deliver one zip.",
            )
        ],
        now=NOW,
    )
    assert plan["action"] == "claim"
    assert plan["signatureMessage"] == "taskmarket:market:claim:0xclaim"
    assert plan["commands"][-1] == "taskmarket task claim 0xclaim"
    assert "--yes" not in plan["commands"][-1]


def test_crowded_deadline_loses_to_a_smaller_open_bounty():
    tasks = [
        _task(
            id="0xcrowd",
            reward="2000000",
            submissionCount=157,
            expiryTime="2026-10-28T22:45:53.670Z",
        ),
        _task(
            id="0xlater",
            referenceCode="TSK-LATER",
            reward="1000000",
            submissionCount=36,
            description="List the transfers. Your public submission must contain its link.",
        ),
    ]
    plan = select_task(tasks, now=NOW)
    assert plan["taskId"] == "0xlater"
    assert any("public URL" in item for item in plan["blockers"])


def test_handler_uses_supplied_tasks_and_does_not_sign():
    ctx = ExecutionContext(
        mode=Mode.DRY_RUN,
        workflow_id="taskmarket_cycle",
        parameters={"tasks": [_task(id="0xhandler", referenceCode="TSK-HANDLER")]},
    )
    plan = json.loads(run(ctx))
    assert plan["referenceCode"] == "TSK-HANDLER"
    assert plan["signs"] is False
    assert plan["stakes"] is False


def test_fetch_stops_when_the_page_says_no_more():
    seen = []

    def get_json(url: str):
        seen.append(url)
        return {"tasks": [_task()], "hasMore": False, "nextCursor": None}

    tasks = fetch_open_tasks(get_json)
    assert len(tasks) == 1
    assert seen == ["https://api.taskmarket.dev/api/tasks?status=open"]
