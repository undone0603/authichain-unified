"""
agentz.core.consequence_gate
----------------------------
Consequence-aware approval for agent side-effects (research build
2026-11-04, "ConseqGate").

Technique: Caper, "Shall We Approve?" Consequence-Aware Approval for
Autonomous Coding Agents (arXiv:2610.40753). Reimplemented from the paper;
no upstream code copied (upstream is Apache-2.0 regardless).

Every proposed action is PRE-EXECUTED against a snapshot first:

* ``ShellExecutor``    runs a shell command inside a copy of a directory and
                       diffs the file tree (created / modified / deleted).
* ``CallableExecutor`` runs a Python ``fn(root)`` against a copy of a
                       directory and diffs the tree. This is how existing
                       AgentZ handlers adopt the gate without rewriting
                       their file-writing code.
* ``SqlExecutor``      runs SQL inside a transaction on any DB-API
                       connection, measures per-table row deltas (duplicate
                       rows counted as a multiset) and ROLLS BACK.

An independent approver then judges the bounded ``EffectReport`` -- never the
command text -- so a harmless-looking tool that hides a destructive effect is
caught. Allowed actions are committed by applying exactly the approved diff
(files) or re-running the statements in a fresh transaction (SQL). Blocked
actions are rolled back with a reason the agent can act on.

Every decision yields a receipt dict shaped for
``public.agent_action_receipts`` (the DB seals the hash chain; this module
never sets ``prev_sha256`` / ``receipt_sha256``) and can be appended to a
local JSONL file. Nothing here talks to Supabase or the network.

Limits: the file sandbox is a directory copy, not a container -- there is no
network or process isolation, so do not gate untrusted commands with it.
Row-delta snapshots are O(table size); pass ``tables=`` to scope them.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import tempfile
from collections import Counter
from collections.abc import Callable, Iterable, Sequence
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

MAX_REPORT_ITEMS = 25  # the approver sees a bounded summary (Caper)
DEFAULT_EXCLUDES = frozenset(
    {"node_modules", ".git", ".next", "dist", "build", "out", "__pycache__",
     ".turbo", ".wrangler", ".venv", "venv"}
)
RECEIPTS_PATH = Path(__file__).resolve().parents[1] / "logs" / "consequence_receipts.jsonl"
RECEIPTS_ENV = "AGENTZ_CONSEQUENCE_RECEIPTS"

Approver = Callable[[dict], "tuple[bool, str]"]


class StaleWorkspaceError(RuntimeError):
    """The real workspace changed between pre-execution and commit."""


# ------------------------------------------------------------------ report
@dataclass
class EffectReport:
    kind: str                                        # "shell" | "callable" | "sql"
    created: list = field(default_factory=list)
    modified: list = field(default_factory=list)
    deleted: list = field(default_factory=list)
    row_deltas: dict = field(default_factory=dict)   # table -> {"inserted","deleted","updated"}
    exit_code: int | None = None
    error: str | None = None
    timed_out: bool = False
    truncated: bool = False
    totals: dict = field(default_factory=dict)

    def bound(self, n: int = MAX_REPORT_ITEMS) -> EffectReport:
        self.totals = {"created": len(self.created), "modified": len(self.modified),
                       "deleted": len(self.deleted)}
        for key in ("created", "modified", "deleted"):
            values = sorted(getattr(self, key))
            if len(values) > n:
                self.truncated = True
            setattr(self, key, values[:n])
        return self

    def to_dict(self) -> dict:
        return asdict(self)


# ------------------------------------------------------------------ files
def _hash_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _tree(root: str, excludes: Iterable[str]) -> dict[str, str]:
    excluded = set(excludes)
    out: dict[str, str] = {}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in excluded]
        for name in filenames:
            path = os.path.join(dirpath, name)
            if os.path.islink(path) or not os.path.isfile(path):
                continue
            out[os.path.relpath(path, root).replace(os.sep, "/")] = _hash_file(path)
    return out


@dataclass
class _FileHandle:
    snap: str
    sandbox: str
    before: dict
    created: list
    modified: list
    deleted: list
    result: Any = None


class _DirectoryExecutor:
    """Shared copy -> run -> diff -> apply-diff machinery."""

    kind = "files"

    def __init__(self, workspace: str | os.PathLike, excludes: Iterable[str] = DEFAULT_EXCLUDES):
        self.workspace = os.path.abspath(os.fspath(workspace))
        self.excludes = frozenset(excludes)

    def _copy(self) -> tuple[str, str]:
        snap = tempfile.mkdtemp(prefix="agentz-cg-")
        sandbox = os.path.join(snap, "ws")
        shutil.copytree(self.workspace, sandbox, symlinks=True,
                        ignore=shutil.ignore_patterns(*self.excludes))
        return snap, sandbox

    def _run(self, action: Any, sandbox: str, report: EffectReport) -> Any:
        raise NotImplementedError

    def preexecute(self, action: Any) -> tuple[EffectReport, _FileHandle]:
        snap, sandbox = self._copy()
        before = _tree(sandbox, self.excludes)
        report = EffectReport(kind=self.kind)
        result = None
        try:
            result = self._run(action, sandbox, report)
        except subprocess.TimeoutExpired:
            report.timed_out = True
        except Exception as exc:  # the action itself failed in the sandbox
            report.error = f"{type(exc).__name__}: {exc}"[-400:]
        after = _tree(sandbox, self.excludes)
        created = sorted(p for p in after if p not in before)
        deleted = sorted(p for p in before if p not in after)
        modified = sorted(p for p in after if p in before and after[p] != before[p])
        report.created, report.modified, report.deleted = list(created), list(modified), list(deleted)
        handle = _FileHandle(snap, sandbox, before, created, modified, deleted, result)
        return report.bound(), handle

    def commit(self, handle: _FileHandle) -> None:
        """Apply exactly the approved diff to the real workspace."""
        try:
            for rel in handle.modified + handle.deleted:
                real = os.path.join(self.workspace, rel)
                if not os.path.isfile(real) or _hash_file(real) != handle.before[rel]:
                    raise StaleWorkspaceError(f"{rel} changed since pre-execution")
            for rel in handle.created:
                if os.path.exists(os.path.join(self.workspace, rel)):
                    raise StaleWorkspaceError(f"{rel} appeared since pre-execution")
            for rel in handle.deleted:
                os.remove(os.path.join(self.workspace, rel))
            for rel in handle.created + handle.modified:
                dst = os.path.join(self.workspace, rel)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(os.path.join(handle.sandbox, rel), dst)
        finally:
            shutil.rmtree(handle.snap, ignore_errors=True)

    def rollback(self, handle: _FileHandle) -> None:
        shutil.rmtree(handle.snap, ignore_errors=True)


class ShellExecutor(_DirectoryExecutor):
    """Pre-execute a shell command in a copy of ``workspace``."""

    kind = "shell"

    def __init__(self, workspace: str | os.PathLike, timeout: float = 20.0,
                 excludes: Iterable[str] = DEFAULT_EXCLUDES):
        super().__init__(workspace, excludes)
        self.timeout = timeout

    def _run(self, command: str, sandbox: str, report: EffectReport) -> Any:
        proc = subprocess.run(command, shell=True, cwd=sandbox, capture_output=True, check=False,
                              timeout=self.timeout,
                              env={"PATH": os.environ.get("PATH", ""), "HOME": sandbox})
        report.exit_code = proc.returncode
        if proc.returncode != 0:
            report.error = proc.stderr.decode(errors="replace")[-400:]
        return proc.returncode


class CallableExecutor(_DirectoryExecutor):
    """Pre-execute ``fn(root: Path)`` against a copy of ``workspace``.

    The function must write only under ``root``. Its return value from the
    sandbox run is kept on the decision as ``result``; on commit the approved
    file diff is copied over -- the function is NOT re-run.
    """

    kind = "callable"

    def _run(self, fn: Callable[[Path], Any], sandbox: str, report: EffectReport) -> Any:
        return fn(Path(sandbox))


class SqlExecutor:
    """Pre-execute SQL in a transaction on a DB-API connection, then roll back.

    ``tables`` scopes the row snapshot. With sqlite3 it may be omitted and
    every user table is snapshotted. Pass SQL as a list of statements to avoid
    the naive ``;`` split used for a plain string.
    """

    kind = "sql"

    def __init__(self, conn: Any, tables: Sequence[str] | None = None):
        self.conn = conn
        self.tables = list(tables) if tables else None
        self._sqlite = isinstance(conn, sqlite3.Connection)
        if self._sqlite:
            self.conn.isolation_level = None  # explicit BEGIN / ROLLBACK
        elif self.tables is None:
            raise ValueError("tables= is required for non-sqlite connections")

    @staticmethod
    def _statements(sql: str | Sequence[str]) -> list[str]:
        items = [sql] if isinstance(sql, str) else list(sql)
        out: list[str] = []
        for item in items:
            out.extend(s for s in item.split(";") if s.strip())
        return out

    def _begin(self) -> None:
        if self._sqlite:
            self.conn.execute("BEGIN")

    def _end(self, commit: bool) -> None:
        if self._sqlite:
            self.conn.execute("COMMIT" if commit else "ROLLBACK")
        elif commit:
            self.conn.commit()
        else:
            self.conn.rollback()

    def _table_names(self, cur: Any) -> list[str]:
        if self.tables is not None:
            return list(self.tables)
        cur.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%'")
        return [row[0] for row in cur.fetchall()]

    def _snapshot(self, cur: Any) -> dict[str, Counter]:
        snap: dict[str, Counter] = {}
        for table in self._table_names(cur):
            try:
                cur.execute(f'select * from "{table}"')
            except Exception:
                continue  # table absent at this point (dropped or not yet created)
            snap[table] = Counter(
                hashlib.sha256(json.dumps(list(row), default=str).encode()).hexdigest()
                for row in cur.fetchall()
            )
        return snap

    def preexecute(self, sql: str | Sequence[str]) -> tuple[EffectReport, list[str]]:
        statements = self._statements(sql)
        report = EffectReport(kind="sql")
        self._begin()
        cur = self.conn.cursor()
        before = self._snapshot(cur)
        after = before
        try:
            for stmt in statements:
                cur.execute(stmt)
            after = self._snapshot(cur)
        except Exception as exc:
            report.error = f"{type(exc).__name__}: {exc}"[:400]
        finally:
            self._end(commit=False)
        for table in sorted(set(before) | set(after)):
            b, a = before.get(table, Counter()), after.get(table, Counter())
            gone, new = sum((b - a).values()), sum((a - b).values())
            updated = min(gone, new) if sum(b.values()) == sum(a.values()) else 0
            delta = {"inserted": new - updated, "deleted": gone - updated, "updated": updated}
            if any(delta.values()):
                report.row_deltas[table] = delta
            if table not in before:
                report.created.append(f"table:{table}")
            if table not in after:
                report.deleted.append(f"table:{table}")
        return report.bound(), statements

    def commit(self, statements: list[str]) -> None:
        self._begin()
        cur = self.conn.cursor()
        try:
            for stmt in statements:
                cur.execute(stmt)
        except Exception:
            self._end(commit=False)
            raise
        self._end(commit=True)

    def rollback(self, handle: Any) -> None:
        pass  # pre-execution already rolled back


# ------------------------------------------------------------------ approval
@dataclass
class ConsequencePolicy:
    protected_globs: tuple = (".env", ".git/", "migrations/", "LICENSE", ".github/workflows/")
    max_deleted_files: int = 0
    max_modified_files: int = 20
    max_created_files: int = 25
    max_rows_deleted: int = 10
    max_rows_updated: int = 100
    protected_tables: tuple = ("agent_action_receipts", "ops_bot_log")


def _is_protected(path: str, globs: Iterable[str]) -> bool:
    for pattern in globs:
        if path == pattern or path.startswith(pattern) or ("/" + pattern) in ("/" + path):
            return True
    return False


def rule_approver(report: EffectReport, policy: ConsequencePolicy) -> tuple[bool, str]:
    """Independent, deterministic approver: judges observed effects only."""
    if report.timed_out:
        return False, "pre-execution timed out; split the action into smaller steps"
    if report.truncated:
        return False, f"effect too broad to review ({report.totals}); narrow the scope"
    touched = report.created + report.modified + report.deleted
    hits = [p for p in touched if _is_protected(p, policy.protected_globs)]
    if hits:
        return False, f"touches protected paths: {hits[:5]}"
    if report.kind != "sql":
        if len(report.deleted) > policy.max_deleted_files:
            return False, f"deletes {len(report.deleted)} file(s): {report.deleted[:5]}; ask the operator"
        if len(report.modified) > policy.max_modified_files:
            return False, f"modifies {len(report.modified)} files (> {policy.max_modified_files})"
        if len(report.created) > policy.max_created_files:
            return False, f"creates {len(report.created)} files (> {policy.max_created_files})"
    for table, delta in report.row_deltas.items():
        if table in policy.protected_tables and (delta["deleted"] or delta["updated"]):
            return False, f"mutates append-only table {table}: {delta}"
        if delta["deleted"] > policy.max_rows_deleted:
            return False, (f"deletes {delta['deleted']} rows from {table} "
                           f"(> {policy.max_rows_deleted}); add a WHERE clause")
        if delta["updated"] > policy.max_rows_updated:
            return False, (f"updates {delta['updated']} rows in {table} "
                           f"(> {policy.max_rows_updated}); add a WHERE clause")
    dropped = [p for p in report.deleted if p.startswith("table:")]
    if report.kind == "sql" and dropped:
        return False, f"drops table(s): {dropped}"
    if report.error:
        return False, f"action failed in sandbox: {report.error[:200]}"
    return True, "observed effects within policy"


MODEL_APPROVER_SYSTEM = (
    "You approve or block an autonomous agent's action. You see ONLY a JSON "
    "report of the effects the action had when it was pre-executed in a "
    "sandbox. Answer with one line: 'ALLOW: <reason>' or 'BLOCK: <reason>'. "
    "Block anything that destroys data, touches secrets, or looks broader "
    "than a routine change."
)


def model_approver(call_llm: Callable[[str, str], str]) -> Approver:
    """Wrap an LLM ``(system, user) -> text`` as a report-only approver.

    Fail-closed: an error or any answer not starting with ALLOW is a block.
    """

    def approve(report: dict) -> tuple[bool, str]:
        try:
            text = (call_llm(MODEL_APPROVER_SYSTEM, json.dumps(report, sort_keys=True)) or "").strip()
        except Exception as exc:
            return False, f"model approver unavailable ({type(exc).__name__}); blocked"
        head, _, tail = text.partition(":")
        if head.strip().upper() == "ALLOW":
            return True, f"model approver: {tail.strip() or 'allowed'}"[:300]
        return False, f"model approver: {tail.strip() or text or 'no verdict'}"[:300]

    return approve


@dataclass
class GateDecision:
    allowed: bool
    reason: str
    report: dict
    receipt: dict
    committed: bool = False
    result: Any = None


def _action_digest(action: Any) -> str:
    if callable(action):
        name = f"{getattr(action, '__module__', '?')}.{getattr(action, '__qualname__', repr(action))}"
        return hashlib.sha256(f"callable:{name}".encode()).hexdigest()
    if not isinstance(action, str):
        action = json.dumps(action, default=str)
    return hashlib.sha256(action.encode()).hexdigest()


class ConsequenceGate:
    """Pre-execute -> approve on effects -> commit or roll back."""

    def __init__(self, executor: Any, policy: ConsequencePolicy | None = None,
                 approver: Approver | None = None, bot: str = "agentz"):
        self.executor = executor
        self.policy = policy or ConsequencePolicy()
        self.approver = approver
        self.bot = bot

    def evaluate(self, action: Any) -> tuple[GateDecision, Any]:
        """Pre-execute and judge, without committing. Returns (decision, handle)."""
        report, handle = self.executor.preexecute(action)
        ok, reason = rule_approver(report, self.policy)
        if ok and self.approver is not None:  # optional second approver, report only
            ok, reason = self.approver(report.to_dict())
        report_dict = report.to_dict()
        receipt = {
            "bot": self.bot,
            "action_type": f"consequence_gate_{report.kind}",
            "target": "",
            "verdict": "pending",
            "candidates": [{"action_sha256": _action_digest(action)}],
            "checks": {"report": {k: v for k, v in report_dict.items() if v}},
            "rationale": reason[:300],
        }
        decision = GateDecision(ok, reason, report_dict, receipt,
                                result=getattr(handle, "result", None))
        return decision, handle

    def finish(self, decision: GateDecision, handle: Any, commit: bool, verdict: str | None = None) -> GateDecision:
        """Commit (only if allowed) or roll back, and seal the receipt verdict."""
        if commit and decision.allowed:
            try:
                self.executor.commit(handle)
                decision.committed = True
            except StaleWorkspaceError as exc:
                decision.allowed = False
                decision.reason = f"stale workspace, not committed: {exc}"
                decision.receipt["rationale"] = decision.reason[:300]
        else:
            self.executor.rollback(handle)
        decision.receipt["verdict"] = verdict or ("executed" if decision.committed else "abstained")
        return decision

    def submit(self, action: Any, target: str = "workspace") -> GateDecision:
        decision, handle = self.evaluate(action)
        decision.receipt["target"] = target
        return self.finish(decision, handle, commit=True)


def write_receipt(receipt: dict, path: str | os.PathLike | None = None) -> Path:
    """Append a receipt to the local JSONL ledger (``agentz/logs`` by default)."""
    target = Path(path or os.environ.get(RECEIPTS_ENV) or RECEIPTS_PATH)
    target.parent.mkdir(parents=True, exist_ok=True)
    row = {"recorded_at": datetime.now(UTC).isoformat(), **receipt}
    with target.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(row, sort_keys=True, default=str) + "\n")
    return target
