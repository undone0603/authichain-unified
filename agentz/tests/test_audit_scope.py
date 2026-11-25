# AgentZ port of AI Adapt research build 2026-10-29 AuditScope (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-29-auditscope-auditable-detector.md
import unittest
from agentz.core.audit_scope import Feature, select_interpretable, AuditableDetector, seal_receipt, verify_chain, audit

FEATS = [Feature("f1", "stacked tricolon lists ('X, Y, and Z')", 0.91),
         Feature("f2", "hedged summary openers ('Overall,', 'In summary')", 0.84),
         Feature("f3", "first-person concrete anecdote", 0.88),
         Feature("f4", "polysemantic: unclear", 0.31)]

def mock_extract(text):  # stands in for SAE activations on a detector residual stream
    t = text.lower()
    return {"f1": float(t.count(", and ")), "f2": 1.0 if t.startswith(("overall", "in summary")) else 0.0,
            "f3": 1.0 if " i " in f" {t} " and "yesterday" in t else 0.0, "f4": 5.0}

AI = ["Overall, it is fast, cheap, and reliable, and it scales, and it ships.",
      "In summary, quality, speed, and cost improve, and teams win."]
HU = ["Yesterday i dropped the battery pack on the dock floor.",
      "i called the supplier yesterday about the cell IDs."]

class T(unittest.TestCase):
    def setUp(self):
        self.kept = select_interpretable(FEATS, 0.7)
        rows = [mock_extract(t) for t in AI + HU]
        self.det = AuditableDetector(self.kept).fit(rows, [1, 1, 0, 0])
    def test_fidelity_gate_drops_unreadable_feature(self):
        self.assertEqual([f.fid for f in self.kept], ["f1", "f2", "f3"])
    def test_threshold_validation(self):
        with self.assertRaises(ValueError): select_interpretable(FEATS, 1.5)
    def test_unlabelled_feature_never_weighted(self):
        self.assertNotIn("f4", self.det.weights)
    def test_classifies_ai_text(self):
        self.assertEqual(self.det.explain(mock_extract(AI[0]))["verdict"], "likely_ai")
    def test_classifies_human_text(self):
        self.assertEqual(self.det.explain(mock_extract(HU[0]))["verdict"], "likely_human")
    def test_evidence_is_human_readable(self):
        ev = self.det.explain(mock_extract(AI[0]))["evidence"]
        self.assertTrue(ev and all(e["tell"] != "polysemantic: unclear" for e in ev))
    def test_receipt_hides_raw_text(self):
        r = audit(AI[1], mock_extract, self.det)
        self.assertNotIn("quality", str(r)); self.assertEqual(len(r["text_sha256"]), 64)
    def test_chain_verifies(self):
        r1 = audit(AI[0], mock_extract, self.det); r2 = audit(HU[1], mock_extract, self.det, r1["receipt_sha256"])
        self.assertTrue(verify_chain([r1, r2]))
    def test_tamper_detected(self):
        r1 = audit(AI[0], mock_extract, self.det); r1["result"]["verdict"] = "likely_human"
        self.assertFalse(verify_chain([r1]))
    def test_fit_rejects_mismatch(self):
        with self.assertRaises(ValueError): AuditableDetector(self.kept).fit([{}], [1, 0])
    def test_sparsity_l1(self):
        det = AuditableDetector(self.kept).fit([mock_extract(t) for t in AI + HU], [1, 1, 0, 0], l1=10.0)
        self.assertTrue(all(w == 0.0 for w in det.weights.values()))

if __name__ == "__main__": unittest.main()
