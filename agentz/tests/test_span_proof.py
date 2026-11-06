# AgentZ port of AI Adapt research build 2026-11-05 SpanProof (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-05-spanproof-checkable-rationale.md
import json, unittest
from agentz.core.span_proof import gate, Statement, evidence_sensitive, parse_model_output, AUTHENTIC, TAMPERED, ABSTAIN

# Battery Passport style document: each span is a declared field; measurers are deterministic.
SPANS = {"capacity": "capacity_kwh=75.0", "chemistry": "chemistry=NMC811", "carbon": "carbon_kgco2e_per_kwh=61.2"}
def num(s): return float(s.split("=")[1])
MEASURERS = {"value": num, "length": lambda s: len(s)}
EXPECT = [Statement("capacity", "value", "<=", 120), Statement("carbon", "value", "<", 200)]

def mock_llm(verdict, rationale):  # stands in for the model call
    return json.dumps({"verdict": verdict, "rationale": rationale})

GOOD = [
    {"span": "capacity", "metric": "value", "op": "==", "value": 75.0, "text": "declared 75 kWh"},
    {"span": "chemistry", "metric": "length", "op": ">", "value": 5, "text": "chemistry present"},
    {"span": "carbon", "metric": "value", "op": "<", "value": 100, "text": "footprint plausible"},
]

class T(unittest.TestCase):
    def test_authentic_passes(self):
        r = gate(mock_llm("AUTHENTIC", GOOD), SPANS, MEASURERS, EXPECT)
        self.assertEqual((r.derived, r.gate), (AUTHENTIC, "pass"))

    def test_refuted_statement_localises_span(self):
        bad = SPANS | {"capacity": "capacity_kwh=90.0"}
        r = gate(mock_llm("AUTHENTIC", GOOD), bad, MEASURERS, EXPECT)
        self.assertEqual(r.derived, TAMPERED); self.assertEqual(r.tampered_spans, ["capacity"]); self.assertEqual(r.gate, "block")

    def test_partial_edit_cannot_hide(self):
        # one of three spans breaks a reference expectation; the other two are fine
        bad = SPANS | {"carbon": "carbon_kgco2e_per_kwh=95.0"}
        exp = EXPECT + [Statement("carbon", "value", "<", 80)]
        r = gate(mock_llm("AUTHENTIC", GOOD), bad, MEASURERS, exp)
        self.assertEqual(r.tampered_spans, ["carbon"]); self.assertFalse(r.consistent)

    def test_verdict_must_follow_evidence(self):
        r = gate(mock_llm("TAMPERED", GOOD), SPANS, MEASURERS, EXPECT)
        self.assertEqual(r.derived, AUTHENTIC); self.assertFalse(r.consistent); self.assertEqual(r.gate, "block")

    def test_uncovered_span_abstains(self):
        r = gate(mock_llm("AUTHENTIC", GOOD[:2]), SPANS, MEASURERS, EXPECT)
        self.assertEqual(r.derived, ABSTAIN); self.assertEqual(r.uncovered_spans, ["carbon"])

    def test_unknown_metric_is_unmeasurable(self):
        rat = GOOD + [{"span": "carbon", "metric": "vibes", "op": ">", "value": 0}]
        r = gate(mock_llm("AUTHENTIC", rat), SPANS, MEASURERS, EXPECT)
        self.assertEqual(r.derived, ABSTAIN); self.assertEqual(r.gate, "block")

    def test_measurer_exception_is_not_evidence(self):
        r = gate(mock_llm("AUTHENTIC", GOOD), SPANS | {"capacity": "garbled"}, MEASURERS, EXPECT)
        self.assertEqual(r.gate, "block")

    def test_unparseable_output_blocks(self):
        r = gate("not json", SPANS, MEASURERS, EXPECT)
        self.assertEqual((r.claimed, r.gate), ("UNPARSEABLE", "block"))

    def test_unknown_operator_blocks(self):
        r = gate(mock_llm("AUTHENTIC", [{"span": "capacity", "metric": "value", "op": "~", "value": 1}]), SPANS, MEASURERS)
        self.assertEqual(r.gate, "block")

    def test_empty_rationale_blocks(self):
        r = gate(mock_llm("AUTHENTIC", []), SPANS, MEASURERS, EXPECT)
        self.assertEqual((r.derived, r.gate), (ABSTAIN, "block"))

    def test_counterfactual_sensitivity(self):
        self.assertTrue(evidence_sensitive(mock_llm("AUTHENTIC", GOOD), SPANS, MEASURERS, EXPECT, "capacity", "capacity_kwh=150"))

    def test_report_json_roundtrip(self):
        r = gate(mock_llm("AUTHENTIC", GOOD), SPANS, MEASURERS, EXPECT)
        self.assertEqual(json.loads(r.to_json())["gate"], "pass")

if __name__ == "__main__":
    unittest.main()
