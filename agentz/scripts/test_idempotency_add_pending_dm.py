#!/usr/bin/env python3
"""Stress-test idempotency of add_pending_dm (10 identical calls → 1 record)."""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

# Ensure repo root on path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from agentz.core import outreach as outreach_mod


def main() -> int:
    with tempfile.TemporaryDirectory() as td:
        db = Path(td) / "pending_dms.json"
        lock = db.with_suffix(".json.lock")
        outreach_mod.OUTREACH_DB_PATH = db
        outreach_mod._LOCK_PATH = lock

        payload = dict(
            lead_name="Pilot Client X",
            personalized_hook="Personalized OAIS demo",
            generic_hook="Industry standard trust verification",
            message="Reduced audit time proof packet ready.",
            microsite_url="https://pilot.authichain.com/oh-dcc",
        )

        results = [outreach_mod.add_pending_dm(**payload) for _ in range(10)]
        created = sum(1 for r in results if r.get("action") == "created")
        ignored = sum(1 for r in results if r.get("action") == "ignored_duplicate")
        dms = outreach_mod.get_pending_dms()

        print(json.dumps({"created": created, "ignored": ignored, "records": len(dms), "results": results}, indent=2))

        if created != 1 or ignored != 9 or len(dms) != 1:
            print("FAIL: expected 1 created, 9 ignored, 1 record", file=sys.stderr)
            return 1

        # Empty payload must reject
        bad = outreach_mod.add_pending_dm(lead_name="Empty Co")
        if bad.get("ok") is not False:
            print("FAIL: empty payload should reject", file=sys.stderr)
            return 1

        # 3-arg compat: (name, message, url) via first three positionals
        compat = outreach_mod.add_pending_dm(
            "Compat Co",
            "Hello compat message",
            "https://example.com/demo",
        )
        if not compat.get("ok") or compat.get("action") != "created":
            print("FAIL: 3-arg compat remap", compat, file=sys.stderr)
            return 1

        print("PASS")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
