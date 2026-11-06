"""AgentZ opt-in orchestration gate tests (offline, no network)."""
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from agentz.core.modes import Mode
from agentz.workflows.handlers import a2a_card_preflight


class WorkflowTests(unittest.TestCase):
    def test_dry_run_with_live_gate_set_does_not_fetch(self):
        with patch.dict(os.environ, {"AGENTZ_A2A_CARD_PREFLIGHT_LIVE": "true"}), patch.object(a2a_card_preflight, "probe_live") as p:
            result = a2a_card_preflight.run(SimpleNamespace(mode=Mode.DRY_RUN))
        self.assertEqual(result["state"], "dry_run")
        p.assert_not_called()

    def test_default_confirm_without_live_gate_does_not_fetch(self):
        with patch.dict(os.environ, {"AGENTZ_A2A_CARD_PREFLIGHT_LIVE": "false"}), patch.object(a2a_card_preflight, "probe_live") as p:
            result = a2a_card_preflight.run(SimpleNamespace(mode=Mode.CONFIRM))
        self.assertEqual(result["state"], "dry_run")
        p.assert_not_called()

    def test_auto_never_fetches_even_with_live_gate_set(self):
        with patch.dict(os.environ, {"AGENTZ_A2A_CARD_PREFLIGHT_LIVE": "true"}), patch.object(a2a_card_preflight, "probe_live") as p:
            result = a2a_card_preflight.run(SimpleNamespace(mode=Mode.AUTO))
        self.assertEqual(result["state"], "dry_run")
        p.assert_not_called()

    def test_explicit_attended_confirmation_and_gate_runs_read_only(self):
        value = {"state": "card_declared_shape_observed", "wallet_used": False}
        with patch.dict(os.environ, {"AGENTZ_A2A_CARD_PREFLIGHT_LIVE": "true"}), patch.object(a2a_card_preflight, "probe_live", return_value=value) as p:
            result = a2a_card_preflight.run(SimpleNamespace(mode=Mode.CONFIRM))
        self.assertEqual(result, value)
        p.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
