"""The direct runner must check an existing workflow limit before dispatch.

These tests use a synthetic handler and a temporary audit log. This guard is
not a reservation, a global limit, or a safe live-payment implementation.
"""
from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from agentz.core import runner
from agentz.core.modes import Mode


class DirectRunnerBudgetGuardTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.audit = Path(self.tmp.name) / "audit.jsonl"
        self.calls = []
        self.handler = SimpleNamespace(run=self._run_synthetic)
        self.credentials = mock.patch.object(runner, "check_all", return_value=([], []))
        self.import_handler = mock.patch.object(
            runner.importlib, "import_module", return_value=self.handler
        )
        self.credentials.start()
        self.import_mock = self.import_handler.start()
        self.addCleanup(self.credentials.stop)
        self.addCleanup(self.import_handler.stop)

    def _run_synthetic(self, ctx):
        self.calls.append(ctx.mode)
        ctx.set_usage({}, 0.05)
        return {"status": "ok"}

    def _workflow(self, limit=1.0, **kwargs):
        return runner.Workflow(
            id="synthetic", title="Synthetic test", priority="low",
            blocks_revenue=False, handler="handlers.synthetic", type="test",
            estimated_minutes=0, financial_limit_usd=limit, **kwargs,
        )

    def _record(self, amount, workflow="synthetic"):
        self.audit.write_text(json.dumps({
            "workflow_id": workflow, "status": "ok",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "cost_usd": amount,
        }) + "\n", encoding="utf-8")

    def _execute(self, wf, mode=Mode.AUTO):
        return runner.execute(wf, mode, verbose=False, audit_log_path=self.audit)

    def test_exhausted_positive_limit_blocks_before_handler_import(self):
        self._record(1.0)
        result = self._execute(self._workflow())
        self.assertEqual(result.status, "blocked")
        self.assertIn("budget exhausted", result.notes)
        self.assertEqual(self.calls, [])
        self.import_mock.assert_not_called()

    def test_ahead_of_limit_allows_existing_behavior(self):
        self._record(0.90)
        result = self._execute(self._workflow())
        self.assertEqual(result.status, "ok")
        self.assertEqual(self.calls, [Mode.AUTO])

    def test_confirm_mode_also_blocks_exhausted_limit(self):
        self._record(1.0)
        result = self._execute(self._workflow(), Mode.CONFIRM)
        self.assertEqual(result.status, "blocked")
        self.assertEqual(self.calls, [])
        self.import_mock.assert_not_called()

    def test_exhausted_limit_blocks_context_fetcher_too(self):
        self._record(1.0)
        with mock.patch.object(subprocess, "check_output") as fetch:
            result = self._execute(self._workflow(context_fetcher="synthetic-fetch"))
        self.assertEqual(result.status, "blocked")
        fetch.assert_not_called()
        self.import_mock.assert_not_called()

    def test_spend_for_a_different_workflow_does_not_exhaust_this_limit(self):
        self._record(5.0, workflow="other")
        result = self._execute(self._workflow())
        self.assertEqual(result.status, "ok")
        self.assertEqual(self.calls, [Mode.AUTO])

    def test_zero_limit_retains_existing_unlimited_semantics(self):
        self._record(5.0)
        result = self._execute(self._workflow(limit=0.0))
        self.assertEqual(result.status, "ok")
        self.assertEqual(self.calls, [Mode.AUTO])

    def test_dry_run_remains_available_when_limit_exhausted(self):
        self._record(5.0)
        self._execute(self._workflow(), Mode.DRY_RUN)
        self.assertEqual(self.calls, [Mode.DRY_RUN])

    def test_existing_confirmation_escalation_remains_in_force(self):
        self._record(0.25)
        result = self._execute(self._workflow(risk_class="high"))
        self.assertEqual(result.status, "ok")
        self.assertEqual(self.calls, [Mode.CONFIRM])


if __name__ == "__main__":
    unittest.main()
