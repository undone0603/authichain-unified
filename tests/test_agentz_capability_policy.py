"""Regression tests for AgentZ capability policy."""
import unittest
from agentz.core.capability_policy import Capability, decide


class CapabilityPolicyTests(unittest.TestCase):
    def test_learning_memory_and_read_browser_are_autonomous(self):
        for action in ("research", "browser_read", "memory_write", "code_branch", "pr_create"):
            with self.subTest(action=action):
                self.assertTrue(decide(action).allowed)

    def test_experiments_need_isolation(self):
        for action in ("experiment", "test_isolated"):
            self.assertFalse(decide(action).allowed)
            self.assertTrue(decide(action, isolated=True).allowed)

    def test_release_requires_both_checks(self):
        for action in ("merge", "deploy"):
            self.assertFalse(decide(action, authorized=True).allowed)
            self.assertFalse(decide(action, release_gate_passed=True).allowed)
            self.assertTrue(decide(action, authorized=True, release_gate_passed=True).allowed)

    def test_sensitive_actions_require_scoped_authorization(self):
        for action in ("payment", "credentials", "policy_change", "external_message"):
            self.assertFalse(decide(action).allowed)
            self.assertTrue(decide(action, authorized=True).allowed)

    def test_unknown_fails_closed(self):
        self.assertFalse(decide("unrestricted_shell").allowed)


if __name__ == "__main__":
    unittest.main()
