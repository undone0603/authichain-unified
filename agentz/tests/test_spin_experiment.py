"""No-network, no-provider regression tests for AgentZ SPIN."""
import unittest
from dataclasses import replace

from agentz.spin_experiment import (
    Evidence, Intent, MAX_CYCLES, spin_cycle, verify_frame,
)


def observation(ref="e1", confidence=0.75):
    return Evidence(ref=ref, observation="CI result observed, source linked", confidence=confidence)


class SpinExperimentTests(unittest.TestCase):
    def test_simulated_analysis_is_a_proposal_not_execution(self):
        frame = spin_cycle(
            (observation(),),
            (Intent("Analyze CI evidence", "analyze", ("e1",)),),
        )
        self.assertTrue(verify_frame(frame))
        self.assertEqual(frame.cycle, 1)
        self.assertEqual(frame.intents[0].status, "proposed_only")
        self.assertEqual(frame.consciousness_claim, "not_assessed")
        self.assertEqual(frame.uncertainty, 0.25)

    def test_sensitive_and_unknown_intents_are_operator_held(self):
        for kind in ("outbound", "payment", "deployment", "database_write",
                     "policy_change", "self_modify", "external_tool", "unknown",
                     "some-new-unknown-category"):
            with self.subTest(kind=kind):
                frame = spin_cycle(
                    (observation(),),
                    (Intent("Act externally", kind, ("e1",)),),
                )
                self.assertEqual(frame.intents[0].status, "operator_hold")

    def test_missing_or_duplicated_evidence_cannot_authorize_intent(self):
        with self.assertRaises(ValueError):
            spin_cycle((observation(),), (Intent("Act", "analyze", ("missing",)),))
        with self.assertRaises(ValueError):
            spin_cycle((observation(), observation()))
        with self.assertRaises(ValueError):
            Intent("Act", "analyze", ("e1", "e1"))

    def test_digest_detects_tampering(self):
        frame = spin_cycle((observation(),))
        self.assertFalse(verify_frame(replace(frame, uncertainty=0)))
        with self.assertRaises(ValueError):
            spin_cycle((observation(),), previous=replace(frame, digest="forged"))

    def test_frames_link_and_stop_after_bounded_cycles(self):
        frame = spin_cycle((observation(),))
        for cycle in range(2, MAX_CYCLES + 1):
            older = frame
            frame = spin_cycle((observation(),), previous=frame)
            self.assertEqual(frame.cycle, cycle)
            self.assertEqual(frame.previous_digest, older.digest)
            self.assertTrue(verify_frame(frame))
        with self.assertRaises(ValueError):
            spin_cycle((observation(),), previous=frame)

    def test_rejects_invalid_confidence_and_excessive_inputs(self):
        for value in (-0.1, 1.1, float("nan"), float("inf")):
            with self.subTest(value=value), self.assertRaises(ValueError):
                observation(confidence=value)
        with self.assertRaises(ValueError):
            spin_cycle(tuple(Evidence(str(i), "observed", 0.5) for i in range(33)))
        with self.assertRaises(ValueError):
            spin_cycle(())

    def test_no_external_executor_or_tool_callback_is_accepted(self):
        frame = spin_cycle(
            (observation(),),
            (Intent("Send an email", "outbound", ("e1",)),),
        )
        self.assertEqual(frame.intents[0].status, "operator_hold")
        self.assertFalse(hasattr(frame, "execute"))
        self.assertFalse(hasattr(frame, "approved"))


if __name__ == "__main__":
    unittest.main()
