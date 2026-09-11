---
name: babysit
description: Operational check-in loop for watching a PR in authichain-unified to merge -- what to check on each wake, how to pace check-ins, and when to stop. Pairs with steward/SKILL.md, which holds the actual policy (known flaky checks, deploy constraints, PR conventions); read steward first if both exist, since it takes precedence on conventions and proactivity.
---

# Babysit: authichain-unified check-in loop

This is the mechanical loop for watching a PR through to merged/closed. It
does not carry its own policy -- see `steward/SKILL.md` for what counts as
a pre-existing/flaky failure, the real deploy paths, PR conventions, and
open cross-cutting issues. Follow that file's judgment calls; use this one
for pacing and the per-wake checklist.

There is no `gh` CLI or marker-file convention in play here -- ignore any
generic babysitting instructions that assume one. Everything below uses
the GitHub MCP tools (`pull_request_read`, `add_issue_comment`,
`subscribe_pr_activity`, etc.) already available in-session.

## On every wake (event or scheduled check-in)

1. Re-fetch the PR's current head, not just the event payload -- a
   `check_run.completed` or `issue_comment` event can arrive out of order.
   Use `pull_request_read` with `get` and `get_check_runs` on the current
   `pullNumber`.
2. Classify every non-green check against `steward/SKILL.md`'s known-flaky
   list (`qron-ai-api`, `passport-demo`) before treating it as this PR's
   problem.
3. Check for new review comments (`get_reviews`, `get_comments`,
   `get_review_comments`) since the last wake, especially from
   `chatgpt-codex-connector[bot]` -- verify findings against the actual
   source before accepting or dismissing them.
4. Act per `steward/SKILL.md`'s posture (own vs. only-watching) and the
   general merge-conflict / CI-red / review-comment ordering.
5. Never end a wake on a PR you own having done nothing -- a push, a
   standing-down comment, or confirming an already-reported blocker still
   holds are the only valid stopping points.

## Pacing

- No fixed cadence beyond what the harness's own PR-subscription wakes
  already provide -- most CI/review activity arrives as its own event, so
  a scheduled check-in is a fallback, not the primary signal.
- When scheduling a fallback check-in (`send_later`/`ScheduleWakeup`),
  roughly an hour out is enough for a PR with no other open blocker.
  Re-arm silently (no user-facing message) if nothing changed since the
  last check.
- Duplicate notifications for a failure already covered by a standing-down
  comment need no new comment and no new check-in acceleration -- just
  note it and move on.

## Stopping

- Stop entirely once GitHub reports the PR merged or closed -- the
  `pull_request.closed` event auto-unsubscribes the session; don't
  re-subscribe or re-open unless explicitly asked.
- If a check-in reveals the PR was closed/merged outside of an event (e.g.
  a missed webhook), treat that as the final state immediately -- don't
  keep polling past it.
