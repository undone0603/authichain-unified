"""Atomic one-time receipt acceptance, separate from receipt creation.

SQLite is suitable only when all acceptors share the same durable database file.
Distributed deployments must use a single transactional database service.
"""
from __future__ import annotations
import hashlib
import sqlite3
from pathlib import Path
from .mcp_receipt import verify_receipt


def consume_once(receipt: dict, db_path: str | Path, *, expected_execution_id: str) -> bool:
    """True on first valid acceptance; False on replay or invalid receipt.

    The caller must provide the expected execution ID from its own challenge
    or authorization context. Never derive that expectation from the receipt.
    """
    if not expected_execution_id or not verify_receipt(receipt, expected_execution_id=expected_execution_id):
        return False
    digest = hashlib.sha256(receipt["jws"].encode("ascii")).hexdigest()
    con = sqlite3.connect(str(db_path), timeout=10, isolation_level=None)
    try:
        con.execute("PRAGMA busy_timeout=10000")
        con.execute("BEGIN IMMEDIATE")
        con.execute("""CREATE TABLE IF NOT EXISTS accepted_agentz_receipts (
            execution_id TEXT PRIMARY KEY,
            receipt_sha256 TEXT NOT NULL UNIQUE,
            accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )""")
        con.execute("INSERT INTO accepted_agentz_receipts (execution_id,receipt_sha256) VALUES (?,?)",
                    (expected_execution_id, digest))
        con.execute("COMMIT")
        return True
    except sqlite3.IntegrityError:
        con.execute("ROLLBACK")
        return False
    except BaseException:
        if con.in_transaction:
            con.execute("ROLLBACK")
        raise
    finally:
        con.close()
