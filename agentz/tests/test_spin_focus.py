"""Deterministic, no-network meta-attention experiments."""
import unittest
from dataclasses import replace

from agentz.spin_experiment import Evidence, Intent, spin_cycle
from agentz.spin_focus import (
    FocusCandidate, inspect_own_focus, inspect_focus_review, review_digest,
)


class SpinFocusTests(unittest.TestCase):
    def make_frame(self):
        return spin_cycle(
            (Evidence("e1", "CI gate failed without runner", .95),
             Evidence("e2", "No paid grant observed", .9),
             Evidence("e3", "Unverified rumor", .2)),
            (Intent("Audit CI runner", "analyze", ("e1",)),
             Intent("Send buyer email", "outbound", ("e2",)),
             Intent("Investigate novelty", "analyze", ("e3",)),
             Intent("Reconcile source", "summarize", ("e2",))),
        )

    def test_focus_prefers_relevant_supported_work(self):
        frame = self.make_frame()
        review = inspect_own_focus(frame, "prove paying customer delivery", (
            FocusCandidate(0, .9, .1),
            FocusCandidate(1, 1.0, .5),
            FocusCandidate(2, .99, 1.0),
            FocusCandidate(3, .7, .5),
        ))
        self.assertEqual(review.selected_index, 0)
        self.assertEqual(review.decision, "proposed_only")
        self.assertEqual(review.held_indices, (1,))
        self.assertEqual(review.insufficient_evidence, (2,))
        self.assertEqual(inspect_focus_review(frame, review), "proposal_only_no_execution")

    def test_all_held_or_unsupported_means_no_action(self):
        frame = self.make_frame()
        review = inspect_own_focus(frame, "customer access", (
            FocusCandidate(1, 1, 0), FocusCandidate(2, .9, 0),
        ))
        self.assertIsNone(review.selected_index)
        self.assertEqual(inspect_focus_review(frame, review), "no_executable_action")

    def test_tampering_detected_second_order(self):
        frame = self.make_frame()
        review = inspect_own_focus(frame, "deliver", (FocusCandidate(0, .8, .2),))
        self.assertEqual(review.digest, review_digest(review))
        self.assertEqual(inspect_focus_review(frame, replace(review, selected_index=1)), "tampered_review")
        self.assertEqual(inspect_focus_review(replace(frame, digest="forged"), review), "invalid_frame")

    def test_confidence_and_relevance_must_be_bounded(self):
        frame = self.make_frame()
        for v in (-.1, 1.1, float("nan"), float("inf")):
            with self.subTest(v=v), self.assertRaises(ValueError):
                FocusCandidate(0, v, 0)
        with self.assertRaises(ValueError):
            inspect_own_focus(frame, "deliver", (FocusCandidate(10, .5, .5),))
        with self.assertRaises(ValueError):
            inspect_own_focus(frame, "deliver", (FocusCandidate(0, .5, .5), FocusCandidate(0, .2, .2)))
        with self.assertRaises(ValueError):
            inspect_own_focus(frame, "", (FocusCandidate(0, .5, .5),))

    def test_novelty_penalty_and_deterministic_ties(self):
        frame = self.make_frame()
        review = inspect_own_focus(frame, "deliver", (
            FocusCandidate(0, .8, 1), FocusCandidate(3, .8, .2),
        ))
        self.assertEqual(review.selected_index, 3)
        for _ in range(5):
            self.assertEqual(review, inspect_own_focus(frame, "deliver", (
                FocusCandidate(0, .8, 1), FocusCandidate(3, .8, .2),
            )))

    def test_no_runtime_executor_or_self_authorization(self):
        frame = self.make_frame()
        review = inspect_own_focus(frame, "deliver", (FocusCandidate(0, .8, .2),))
        self.assertFalse(hasattr(review, "execute"))
        self.assertFalse(hasattr(review, "approve"))
        self.assertEqual(review.consciousness_claim, "not_assessed")


if __name__ == "__main__":
    unittest.main()
