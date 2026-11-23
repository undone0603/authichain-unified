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

    def test_merge_requires_high_confidence_but_not_per_merge_approval(self):
        self.assertFalse(decide("merge").allowed)
        self.assertFalse(decide("merge", authorized=True).allowed)
        for authorized in (False, True):
            with self.subTest(authorized=authorized):
                decision = decide("merge", authorized=authorized, release_gate_passed=True)
                self.assertTrue(decision.allowed)
                self.assertTrue(decision.requires_release_gate)

    def test_version_release_still_requires_owner_and_release_gate(self):
        self.assertFalse(decide("deploy").allowed)
        self.assertFalse(decide("deploy", authorized=True).allowed)
        self.assertFalse(decide("deploy", release_gate_passed=True).allowed)
        self.assertTrue(decide("deploy", authorized=True, release_gate_passed=True).allowed)

    def test_sensitive_actions_require_scoped_authorization(self):
        for action in (
            "payment",
            "credentials",
            "policy_change",
            "external_message",
            "customer_send",
            "spend",
            "identity_publish",
            "guardrail_edit",
        ):
            with self.subTest(action=action):
                self.assertFalse(decide(action).allowed)
                self.assertTrue(decide(action, authorized=True).allowed)

    def test_unknown_fails_closed(self):
        self.assertFalse(decide("unrestricted_shell").allowed)


if __name__ == "__main__":
    unittest.main()
