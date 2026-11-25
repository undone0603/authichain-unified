# Consequence gate (ConseqGate) and the research-build gate library

_Added 2026-11-05. Status: library + self-test only. No existing AgentZ handler
is routed through any of these modules yet, and nothing here writes to Supabase._

## What landed

| Module                            | Research build         | Paper                       | What it does                                                                                                                 |
| --------------------------------- | ---------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `agentz/core/consequence_gate.py` | ConseqGate, 2026-11-04 | Caper, arXiv:2610.40753     | Pre-executes an action in a snapshot, judges the **observed effects** (never the command text), then commits or rolls back.  |
| `agentz/core/cite_check.py`       | CiteCheck, 2026-10-31  | ABF-Bench, arXiv:2610.23656 | Every claim must cite a record the agent actually retrieved; quotes and SHA-256s are checked.                                |
| `agentz/core/ladder_gate.py`      | LadderGate, 2026-10-28 | arXiv:2610.34491            | Calls the cheapest effort tier first and escalates only after a verified failure; all-fail goes to human review.             |
| `agentz/core/loop_guard.py`       | LoopGuard, 2026-10-22  | DeLoop, arXiv:2610.19376    | Detects repeated tool calls with identical observations, nudges or halts, and mines DPO pairs from rollouts.                 |
| `agentz/core/protocol_rubric.py`  | ProRubric, 2026-10-14  | arXiv:2609.38847            | Protocol-level rubric: a dimension counts only when all its criteria hold, so one missing signature cannot be averaged away. |

All five are standard-library Python, reimplemented from the papers. No upstream
code is copied. The spec for each build, with its license and regulatory-window
notes, is in the AI Adapt project knowledge under `claude/builds/`.

## ConseqGate in AgentZ

### Executors

- `ShellExecutor(workspace)` runs a shell command in a copy of `workspace` and
  diffs the file tree. `node_modules`, `.git`, build output and virtualenvs are
  not copied and are never touched.
- `CallableExecutor(workspace)` runs a Python `fn(root: Path)` against a copy.
  This is how an existing handler adopts the gate: point its writes at `root`
  instead of the real path. On commit, the approved diff is copied over and the
  function is **not** re-run.
- `SqlExecutor(conn, tables=None)` runs SQL in a transaction on any DB-API
  connection, measures per-table row deltas (duplicate rows counted as a
  multiset), then rolls back. `tables=` is required for non-SQLite connections.
  Pass a list of statements to avoid the naive `;` split.

A file commit is refused as **stale** if any file it would modify or delete
changed after pre-execution, or a file it would create appeared.

### Approval

`rule_approver` (deterministic) runs first, using `ConsequencePolicy`:

| Rule                                     | Default                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Protected paths                          | `.env`, `.git/`, `migrations/`, `LICENSE`, `.github/workflows/`                                         |
| Files deleted / modified / created       | 0 / 20 / 25                                                                                             |
| Rows deleted / updated per table         | 10 / 100                                                                                                |
| Append-only tables (no update or delete) | `agent_action_receipts`, `ops_bot_log`                                                                  |
| Also blocks                              | timeouts, failed actions, dropped tables, a report too broad to review (more than 25 paths in one list) |

An optional second approver sees only the effect report:
`model_approver(call_llm)` wraps any `(system, user) -> text` LLM. It fails
closed: an error, or any answer that does not start with `ALLOW`, is a block.

### Modes: `ctx.gated_step`

`ExecutionContext.gated_step(description, executor, action, target=..., policy=..., approver=...)`
pre-executes in **every** mode:

| Mode      | Allowed action                        | Blocked action                        |
| --------- | ------------------------------------- | ------------------------------------- |
| `dry-run` | real effects printed, nothing changed | real effects printed, nothing changed |
| `confirm` | asks `y/N`, commits only on `y`       | rolled back without a prompt          |
| `auto`    | committed                             | rolled back                           |

A block is final. The existing `ctx.step` is unchanged.

### Receipts

Each `gated_step` appends one JSON line to
`agentz/logs/consequence_receipts.jsonl` (git-ignored; override with
`AGENTZ_CONSEQUENCE_RECEIPTS` or `receipts_path=`). The row uses the
`public.agent_action_receipts` shape: `bot`, `action_type`, `target`,
`verdict` (`executed`, `abstained`, `declined`, `dry_run`), `candidates`
(the SHA-256 of the action, never its text), `checks.report`, and `rationale`.
It never sets `prev_sha256` or `receipt_sha256`; the database seals the chain
when a row is inserted there.

### Self-test

```bash
python -m agentz.cli run consequence_gate_selftest --mode dry-run
```

Six scenarios in a temp dir and an in-memory SQLite DB. The expected result is
`6/6` plus `rollback_intact: true`. It fails loudly otherwise.

## Limits

- The file sandbox is a directory copy, not a container. There is no network or
  process isolation, so do not gate untrusted commands with it.
- A SQL commit re-runs the statements, so non-deterministic SQL (`now()`,
  `random()`) can differ between pre-run and commit.
- Row snapshots are O(table size). Scope them with `tables=`.
- On Postgres, a failing statement aborts the transaction, and the "after"
  snapshot is then skipped. The report still carries the error, so the action
  is blocked.

## Proposed, not applied

A Postgres preview helper (`public.conseqgate_preview`) is in the 2026-11-04
build spec. Applying it is the owner's call, and it should be granted only to
the agent role, never to `anon`.

## Next adopters (owner decision)

1. `repo_audit_integrate`: route its two doc writes through
   `ctx.gated_step(..., CallableExecutor(root / "docs"), ...)`.
2. Battery Passport writes: `SqlExecutor` in front of agent SQL. Then CiteCheck
   and ProRubric in front of field publication, and LadderGate around extraction.
3. LoopGuard in warn-only mode around one bot's tools for 7 days.
