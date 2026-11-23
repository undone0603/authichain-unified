# AgentZ port of AI Adapt research build 2026-10-14 ProRubric (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-14-prorubric-protocol-gate.md
import unittest
from agentz.core.protocol_rubric import *

GOOD = {"battery_id": "BP-001", "manufacturer": "Acme Cells", "issuer_signature": "sig",
        "carbon_footprint_kgco2e": 61.2, "carbon_footprint_source": "third-party LCA",
        "recycled_content_pct": 16, "chemistry": "LFP"}

class T(unittest.TestCase):
    def ev(self, r): return evaluate(r, BATTERY_DIMS, rule_judge(BATTERY_CHECKS))
    def test_complete_record_approved(self):
        v = self.ev(GOOD); self.assertTrue(v.approved); self.assertEqual(v.protocol_score, 1.0)
    def test_compensation_blocked(self):
        r = dict(GOOD); del r["issuer_signature"]          # miss the one check that matters
        v = self.ev(r)
        self.assertGreater(v.additive_score, 0.85)          # additive still looks great
        self.assertFalse(v.approved); self.assertFalse(v.dimensions["identity"])
        self.assertEqual(v.failed_criteria["identity"], ["signature_present"])
    def test_failure_clause_voids_dimension(self):
        r = dict(GOOD, carbon_footprint_source="self-attested")
        v = self.ev(r)
        self.assertEqual(v.additive_score, 1.0)             # every field present
        self.assertFalse(v.dimensions["carbon"]); self.assertIn("FAIL_self_attested_only", v.fired_failure_clauses)
    def test_range_check(self):
        v = self.ev(dict(GOOD, recycled_content_pct=140)); self.assertFalse(v.dimensions["materials"])
    def test_partial_threshold(self):
        r = dict(GOOD); del r["chemistry"]
        v = evaluate(r, BATTERY_DIMS, rule_judge(BATTERY_CHECKS), threshold=0.6)
        self.assertAlmostEqual(v.protocol_score, 0.6667, places=3); self.assertTrue(v.approved)
    def test_receipt_deterministic(self):
        self.assertEqual(self.ev(GOOD).receipt_sha256, self.ev(dict(GOOD)).receipt_sha256)
        self.assertNotEqual(self.ev(GOOD).receipt_sha256, self.ev(dict(GOOD, battery_id="BP-002")).receipt_sha256)
    def test_llm_judge_mocked(self):
        calls = []
        def fake(prompt): calls.append(prompt); return "NO" if "signature_present" in prompt else "YES"
        dims = [Dimension("identity", ["has_battery_id", "signature_present"])]
        v = evaluate(GOOD, dims, llm_judge(fake))
        self.assertEqual(len(calls), 2); self.assertFalse(v.approved); self.assertEqual(v.additive_score, 0.5)
    def test_weighted(self):
        dims = [Dimension("a", ["has_battery_id"], weight=3), Dimension("b", ["chemistry_declared"], weight=1)]
        v = evaluate({"battery_id": "x"}, dims, rule_judge(BATTERY_CHECKS), threshold=0.7)
        self.assertEqual(v.protocol_score, 0.75); self.assertTrue(v.approved)

if __name__ == "__main__": unittest.main()
