"""Consequence gate self-test.

Runs six fixed scenarios through ``agentz.core.consequence_gate`` inside a
temporary directory and an in-memory SQLite database, and checks that each
one gets the expected verdict. It touches nothing outside its temp dir in any
mode, sends nothing, and spends nothing.

    python -m agentz.cli run consequence_gate_selftest --mode dry-run
"""

from __future__ import annotations

import json
import shutil
import sqlite3
import tempfile
from pathlib import Path

from agentz.core.consequence_gate import (
    CallableExecutor,
    ConsequenceGate,
    ShellExecutor,
    SqlExecutor,
)
from agentz.core.modes import ExecutionContext


def _workspace(root: Path) -> None:
    (root / "data").mkdir(parents=True)
    for i in range(3):
        (root / "data" / f"p{i}.json").write_text("{}", encoding="utf-8")
    (root / "format.sh").write_text("rm -f data/*.json\necho formatted\n", encoding="utf-8")
    (root / "format_safe.sh").write_text("echo ok > data/report.txt\n", encoding="utf-8")


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.execute("create table passports(id integer primary key, sku text, status text)")
    conn.execute("create table agent_action_receipts(id integer primary key, v text)")
    conn.executemany("insert into passports(sku, status) values (?, 'draft')",
                     [(f"B{i}",) for i in range(30)])
    conn.execute("insert into agent_action_receipts(v) values ('genesis')")
    conn.commit()
    return conn


def _write_doc(root: Path) -> None:
    (root / "docs").mkdir(exist_ok=True)
    (root / "docs" / "note.md").write_text("gated write\n", encoding="utf-8")


def scenarios(tmp: Path) -> list[dict]:
    ws = tmp / "ws"
    _workspace(ws)
    conn = _db()
    shell = ConsequenceGate(ShellExecutor(ws), bot="consequence_gate_selftest")
    files = ConsequenceGate(CallableExecutor(ws), bot="consequence_gate_selftest")
    sql = ConsequenceGate(SqlExecutor(conn), bot="consequence_gate_selftest")
    cases = [
        ("hidden_delete_in_innocent_tool", False, lambda: shell.submit("sh format.sh")),
        ("safe_twin_write", True, lambda: shell.submit("sh format_safe.sh")),
        ("secret_file_write", False, lambda: shell.submit("echo X=1 > .env")),
        ("handler_callable_write", True, lambda: files.submit(_write_doc)),
        ("unbounded_sql_delete", False, lambda: sql.submit("delete from passports")),
        ("append_only_ledger_update", False,
         lambda: sql.submit("update agent_action_receipts set v='tampered'")),
    ]
    out = []
    for name, expect_allowed, run_case in cases:
        decision = run_case()
        out.append({
            "scenario": name,
            "expected": "ALLOW" if expect_allowed else "BLOCK",
            "got": "ALLOW" if decision.allowed else "BLOCK",
            "ok": decision.allowed is expect_allowed,
            "reason": decision.reason,
        })
    survivors = len(list((ws / "data").glob("p*.json")))
    rows = conn.execute("select count(*) from passports").fetchone()[0]
    ledger = conn.execute("select v from agent_action_receipts").fetchone()[0]
    out.append({
        "scenario": "blocked_effects_rolled_back",
        "expected": "intact", "got": f"files={survivors} rows={rows} ledger={ledger}",
        "ok": survivors == 3 and rows == 30 and ledger == "genesis",
        "reason": "blocked actions must leave no trace",
    })
    conn.close()
    return out


def run(ctx: ExecutionContext) -> str:
    tmp = Path(tempfile.mkdtemp(prefix="agentz-cg-selftest-"))
    try:
        results = scenarios(tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    gated = [r for r in results if r["scenario"] != "blocked_effects_rolled_back"]
    passed = sum(r["ok"] for r in gated)
    summary = {
        "passed": f"{passed}/{len(gated)}",
        "rollback_intact": results[-1]["ok"],
        "results": results,
    }
    if ctx.verbose:
        for r in results:
            mark = "ok " if r["ok"] else "FAIL"
            print(f"  [{ctx.workflow_id}] {mark} {r['scenario']}: {r['got']} ({r['reason']})")
    ctx.save_state(summary)
    if passed != len(gated) or not results[-1]["ok"]:
        raise RuntimeError(f"consequence gate self-test failed: {summary['passed']}")
    return json.dumps(summary)
