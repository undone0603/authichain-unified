# AgentZ port of AI Adapt research build 2026-10-28 LadderGate (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-28-laddergate-effort-escalation.md
import unittest
from agentz.core.ladder_gate import run_ladder, passport_verifier, DEFAULT_TIERS, Tier

GOOD = {"manufacturer_id": "M-1", "battery_category": "EV", "rated_capacity_ah": 60.0, "chemistry": "LFP"}

def mock_caller(by_effort):
    calls = []
    def call(effort, task):
        calls.append(effort); v = by_effort[effort]
        if isinstance(v, Exception): raise v
        return v
    call.calls = calls
    return call

class TestLadder(unittest.TestCase):
    def test_low_tier_pass_stops_early(self):
        c = mock_caller({"low": GOOD, "medium": GOOD, "high": GOOD})
        r = run_ladder({}, c, passport_verifier(), DEFAULT_TIERS)
        self.assertEqual((r.status, r.tier, c.calls), ("accepted", "low", ["low"]))
        self.assertAlmostEqual(r.total_cost_est, 0.002)

    def test_escalates_on_verified_failure(self):
        bad = dict(GOOD); del bad["chemistry"]
        c = mock_caller({"low": bad, "medium": GOOD, "high": GOOD})
        r = run_ladder({}, c, passport_verifier(), DEFAULT_TIERS)
        self.assertEqual((r.tier, c.calls), ("medium", ["low", "medium"]))
        self.assertIn("missing:chemistry", r.attempts[0].reasons)

    def test_exhausted_goes_to_human_review_never_accepts(self):
        bad = dict(GOOD, battery_category="toaster")
        c = mock_caller({"low": bad, "medium": bad, "high": bad})
        r = run_ladder({}, c, passport_verifier(), DEFAULT_TIERS)
        self.assertEqual((r.status, r.output, r.tier), ("human_review", None, None))
        self.assertEqual(len(r.attempts), 3)

    def test_exception_is_failure_not_pass(self):
        c = mock_caller({"low": TimeoutError(), "medium": GOOD, "high": GOOD})
        r = run_ladder({}, c, passport_verifier(), DEFAULT_TIERS)
        self.assertEqual(r.tier, "medium")
        self.assertEqual(r.attempts[0].reasons, ["error:TimeoutError"])

    def test_scorer_below_threshold_escalates(self):
        scores = iter([0.4, 0.95])
        c = mock_caller({"low": GOOD, "medium": GOOD, "high": GOOD})
        r = run_ladder({}, c, passport_verifier(lambda t, o: next(scores), 0.8), DEFAULT_TIERS)
        self.assertEqual(r.tier, "medium")
        self.assertEqual(r.attempts[0].score, 0.4)

    def test_scorer_skipped_when_schema_fails(self):
        called = []
        v = passport_verifier(lambda t, o: called.append(1) or 1.0)
        ok, score, reasons = v({}, {"manufacturer_id": "x"})
        self.assertFalse(ok); self.assertIsNone(score); self.assertEqual(called, [])

    def test_type_and_range_checks(self):
        v = passport_verifier()
        self.assertIn("type:rated_capacity_ah", v({}, dict(GOOD, rated_capacity_ah="60"))[2])
        self.assertIn("type:rated_capacity_ah", v({}, dict(GOOD, rated_capacity_ah=True))[2])
        self.assertIn("range:rated_capacity_ah", v({}, dict(GOOD, rated_capacity_ah=-1))[2])
        self.assertEqual(v({}, "text")[2], ["not_a_dict"])

    def test_receipt_hashes_output_without_leaking_it(self):
        c = mock_caller({"low": GOOD, "medium": GOOD, "high": GOOD})
        rc = run_ladder({}, c, passport_verifier(), DEFAULT_TIERS).receipt()
        self.assertNotIn("output", rc)
        self.assertEqual(len(rc["attempts"][0]["output_sha256"]), 64)

    def test_empty_tiers_rejected(self):
        with self.assertRaises(ValueError):
            run_ladder({}, mock_caller({}), passport_verifier(), [])

    def test_cost_accumulates_across_tiers(self):
        bad = {}
        c = mock_caller({"a": bad, "b": GOOD})
        r = run_ladder({}, c, passport_verifier(), [Tier("a", "a", 0.01), Tier("b", "b", 0.05)])
        self.assertAlmostEqual(r.total_cost_est, 0.06)

if __name__ == "__main__":
    unittest.main()
