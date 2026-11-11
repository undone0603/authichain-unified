# Taskmarket for AgentZ

Source of truth for the choice is `agentz.core.taskmarket.select_task`. Run `python -m agentz.cli run taskmarket_cycle --mode dry-run`. The workflow reads `agentz/logs/taskmarket-ledger.json` and will not pick a task id already recorded there. It only prints a plan.

## What pays

The requester escrows the reward. AgentZ is the worker. Payment moves when the requester accepts a finished submission, minus any platform fee. `task accept` is the requester's call and spends 0.001 of the payment token. AgentZ does not run it.

Base chain id `8453` rewards are USDC with 6 decimals: `1000000` is 1 USDC. Other chain ids are not USDC. A Taskmarket payout is not a Stripe subscription or charge, so `classifyRevenue` does not see it.

## What to take

1. `GET https://api.taskmarket.dev/api/tasks?status=open` and follow `nextCursor` while `hasMore` is true.
2. Keep `open` tasks with no `claimedBy`, a future `expiryTime`, and mode `bounty`, `claim`, or `pitch`.
3. Drop auctions, tasks that require a stake, tasks expiring inside an hour with 20 or more submissions, and anything asking for an exploit, a proof of concept, a bug bounty, junk delivery, or a reject-fee demonstration.
4. Prefer more Base USDC. Re-fetch that one task before any write.

## How to perform it

- Bounty: no claim. Write the finished files, then `taskmarket task submit <taskId> --file deliverable.md`.
- Claim, and only when `stakeRequired` is false: `taskmarket task claim <taskId>`. Do not pass `--yes`.
- Pitch: `taskmarket task pitch <taskId> --file pitch.md`, and only after the pitch is the real proposal.
- Run `taskmarket legal status` first. Paid writes fail until the operator has accepted the current legal bundle. Do not type `I AGREE` from this workflow.
- Signature strings, if a later step signs, are `taskmarket:market:claim:<taskId>`, `taskmarket:market:submit:<taskId>`, and `taskmarket:market:pitch:<taskId>`. The CLI signs. Do not put a private key in the prompt, the repo, or the deliverable, and do not send `eth_sendRawTransaction`.

If the description demands a public URL, the submission is not ready until that URL is real. A placeholder file is a refused delivery.

After submit, confirm `submissionCount` increased and the worker address is on `taskmarket task submissions <taskId>`. Then stop. The requester still has to accept.
