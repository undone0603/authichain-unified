# AgentZ port of AI Adapt research build 2026-11-11 EvidenceMemory (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-11-evidencememory-linked-lessons.md
import unittest
from agentz.core.evidence_memory import EvidenceMemory, sha256_json

T_OK = {"steps": ["read datasheet p4", "unit kgCO2e/kWh"], "result": "accepted"}
T_FAIL = {"steps": ["used kgCO2e per pack"], "result": "rejected: unit"}


def store():
    db = {"t1": T_OK, "t2": T_FAIL}
    return db, EvidenceMemory(lambda ref: db[ref])


class T(unittest.TestCase):
    def test_clean_success_is_trusted_without_loading(self):
        calls = []
        m = EvidenceMemory(lambda r: calls.append(r) or T_OK)
        m.add("L1", "bp.carbon", "Report carbon per kWh", "success", "matched spec", "t1", T_OK, {"unit": "kgCO2e/kWh"})
        r = m.prepare(["unit"])
        self.assertEqual(r[0].status, "TRUSTED"); self.assertEqual(calls, [])

    def test_failed_lesson_descends(self):
        db, m = store()
        m.add("L2", "bp.carbon", "Report carbon per pack", "failure", "unit rejected", "t2", T_FAIL, {"unit": "pack"})
        self.assertIn("from_failed_run", m.prepare()[0].reasons)

    def test_conflict_detected_on_same_key(self):
        db, m = store()
        m.add("L1", "bp.carbon", "per kWh", "success", "ok", "t1", T_OK, {"unit": "x"})
        m.add("L3", "bp.carbon", "per pack", "success", "ok", "t1", T_OK, {"unit": "x"})
        self.assertTrue(all("conflicts" in r.reasons for r in m.prepare()))

    def test_missing_slot_triggers_descent(self):
        db, m = store()
        m.add("L1", "bp.carbon", "per kWh", "success", "ok", "t1", T_OK)
        self.assertEqual(m.prepare(["unit"])[0].reasons, ["missing:unit"])

    def test_corrector_fixes_from_evidence(self):
        db, m = store()
        m.add("L2", "bp.carbon", "Report carbon per pack", "failure", "unit rejected", "t2", T_FAIL)
        fix = lambda l, traj, reasons: "Do not report per pack; the spec wants kgCO2e/kWh" if "rejected" in traj["result"] else None
        r = m.prepare(corrector=fix)[0]
        self.assertEqual(r.status, "CORRECTED"); self.assertIn("kWh", r.insight)

    def test_tampered_evidence_quarantines(self):
        db, m = store()
        m.add("L2", "bp.carbon", "per pack", "failure", "x", "t2", T_FAIL)
        db["t2"] = {"steps": [], "result": "accepted"}
        r = m.prepare()[0]
        self.assertEqual(r.status, "QUARANTINED"); self.assertIn("evidence_hash_mismatch", r.reasons)

    def test_missing_evidence_quarantines(self):
        db, m = store()
        m.add("L2", "bp.carbon", "per pack", "failure", "x", "gone", T_FAIL)
        self.assertIn("evidence_unavailable:KeyError", m.prepare()[0].reasons)

    def test_context_drops_quarantined(self):
        db, m = store()
        m.add("L1", "a", "keep me", "success", "ok", "t1", T_OK)
        m.add("L2", "b", "drop me", "failure", "x", "t2", T_FAIL)
        db["t2"] = {}
        ctx = EvidenceMemory.context(m.prepare())
        self.assertIn("keep me", ctx); self.assertNotIn("drop me", ctx)

    def test_corrector_none_keeps_insight_as_reviewed(self):
        db, m = store()
        m.add("L2", "k", "per pack", "failure", "x", "t2", T_FAIL)
        r = m.prepare(corrector=lambda *a: None)[0]
        self.assertEqual((r.status, r.insight), ("REVIEWED", "per pack"))

    def test_bad_outcome_rejected(self):
        _, m = store()
        with self.assertRaises(ValueError):
            m.add("x", "k", "i", "maybe", "w", "t1", T_OK)

    def test_hash_is_key_order_independent(self):
        self.assertEqual(sha256_json({"a": 1, "b": 2}), sha256_json({"b": 2, "a": 1}))


if __name__ == "__main__":
    unittest.main()
