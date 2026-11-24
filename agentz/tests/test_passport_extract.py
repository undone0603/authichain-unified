# AgentZ port of AI Adapt research build 2026-10-21 Clairic passport extraction (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-21-clairic-battery-passport-extraction.md
import json, unittest
from agentz.core import passport_extract as px

DOC = ("Technical data sheet - Voltara Cells GmbH\n"
       "Manufactured: 2026-08-14. Chemistry: NMC811.\n"
       "Rated capacity 105.0 Ah at nominal voltage 355.2 V. Pack weight 412.5 kg.\n"
       "Carbon footprint: 61.3 kgCO2e/kWh. Recycled cobalt 16.0 %, recycled nickel 6.0 %.\n")

def span(s):
    i = DOC.index(s); return [i, i + len(s)]

def good_answers():
    return {
        "manufacturer_name": {"type": "text", "value": "Voltara Cells GmbH", "guess": "Voltara Cells GmbH",
                              "confidence": 0.9991, "p_null": 1e-6, "span": span("Voltara Cells GmbH")},
        "manufacturing_date": {"type": "date", "value": "2026-08-14", "confidence": 0.9998, "p_null": 1e-7},
        "battery_chemistry": {"type": "text", "value": "NMC811", "confidence": 0.998, "p_null": 1e-6, "span": span("NMC811")},
        "rated_capacity_ah": {"type": "number", "value": 105.0, "confidence": 0.999, "p_null": 1e-6},
        "nominal_voltage_v": {"type": "number", "value": 355.2, "confidence": 0.999, "p_null": 1e-6},
        "weight_kg": {"type": "number", "value": 412.5, "confidence": 0.997, "p_null": 1e-6},
        "carbon_footprint_kgco2e_per_kwh": {"type": "number", "value": 61.3, "confidence": 0.996, "p_null": 1e-5},
        "recycled_cobalt_pct": {"type": "number", "value": 16.0, "confidence": 0.99, "p_null": 1e-5},
        "recycled_lithium_pct": {"type": "number", "value": None, "guess": 6.0, "confidence": 0.41, "p_null": 0.97},
        "recycled_nickel_pct": {"type": "number", "value": 6.0, "confidence": 0.98, "p_null": 1e-5},
        "expected_lifetime_cycles": {"type": "number", "value": None, "guess": 3000, "confidence": 0.3, "p_null": 0.99},
    }

class FakeTransport:
    def __init__(self, resp): self.resp, self.calls = resp, []
    def __call__(self, payload): self.calls.append(payload); return self.resp

class TestPassportExtract(unittest.TestCase):
    def test_request_shape_matches_launch_post(self):
        req = px.build_request(DOC)
        self.assertEqual(req["state"], DOC)
        self.assertEqual(req["fields"]["rated_capacity_ah"]["unit"], "Ah")
        self.assertEqual(req["fields"]["manufacturing_date"]["type"], "date")
        self.assertEqual(set(req["fields"]), set(px.BATTERY_FIELDS))

    def test_clean_doc_is_complete(self):
        d = px.extract(DOC, FakeTransport({"answers": good_answers()}))
        self.assertTrue(d.complete)
        self.assertEqual(d.summary(), {"ACCEPT": 9, "REVIEW": 0, "MISSING": 2})

    def test_absent_value_not_filled_from_guess(self):
        d = px.extract(DOC, FakeTransport({"answers": good_answers()}))
        f = d.fields["recycled_lithium_pct"]
        self.assertEqual(f.status, px.MISSING); self.assertIsNone(f.value)
        self.assertTrue(any("unused guess" in r for r in f.reasons))

    def test_low_confidence_goes_to_review(self):
        a = good_answers(); a["weight_kg"]["confidence"] = 0.77
        d = px.extract(DOC, FakeTransport({"answers": a}))
        self.assertEqual(d.fields["weight_kg"].status, px.REVIEW)
        self.assertFalse(d.complete)

    def test_out_of_range_goes_to_review(self):
        a = good_answers(); a["recycled_cobalt_pct"]["value"] = 160.0
        d = px.extract(DOC, FakeTransport({"answers": a}))
        self.assertEqual(d.fields["recycled_cobalt_pct"].status, px.REVIEW)
        self.assertTrue(d.complete)  # optional field: draft still complete

    def test_fraction_vs_percent_cross_check(self):
        a = good_answers(); a["recycled_nickel_pct"]["value"] = 0.06
        d = px.extract(DOC, FakeTransport({"answers": a}))
        self.assertEqual(d.fields["recycled_nickel_pct"].status, px.REVIEW)

    def test_text_needs_span_evidence(self):
        a = good_answers(); del a["battery_chemistry"]["span"]
        d = px.extract(DOC, FakeTransport({"answers": a}))
        self.assertEqual(d.fields["battery_chemistry"].status, px.REVIEW)

    def test_span_mismatch_flagged(self):
        a = good_answers(); a["battery_chemistry"]["value"] = "LFP"
        d = px.extract(DOC, FakeTransport({"answers": a}))
        self.assertEqual(d.fields["battery_chemistry"].status, px.REVIEW)

    def test_evidence_quotes_source(self):
        d = px.extract(DOC, FakeTransport({"answers": good_answers()}))
        self.assertEqual(d.fields["manufacturer_name"].evidence, "Voltara Cells GmbH")

    def test_missing_required_blocks_completion(self):
        a = good_answers(); a["carbon_footprint_kgco2e_per_kwh"] = {"type": "number", "value": None, "p_null": 0.98}
        d = px.extract(DOC, FakeTransport({"answers": a}))
        self.assertFalse(d.complete)
        self.assertIn("carbon_footprint_kgco2e_per_kwh", px.ledger_receipt(d, "BAT-1")["missing"])

    def test_rest_envelope_and_bare_answers(self):
        for resp in ({"result": {"answers": good_answers()}, "success": True}, good_answers()):
            self.assertTrue(px.extract(DOC, FakeTransport(resp)).complete)
        with self.assertRaises(ValueError):
            px.extract(DOC, FakeTransport({"errors": ["boom"]}))

    def test_receipt_hashes_stable_and_sensitive(self):
        d1 = px.extract(DOC, FakeTransport({"answers": good_answers()}))
        d2 = px.extract(DOC, FakeTransport({"answers": good_answers()}))
        self.assertEqual(d1.accepted_sha256, d2.accepted_sha256)
        a = good_answers(); a["weight_kg"]["value"] = 412.6
        d3 = px.extract(DOC, FakeTransport({"answers": a}))
        self.assertNotEqual(d1.accepted_sha256, d3.accepted_sha256)
        r = px.ledger_receipt(d1, "BAT-1")
        self.assertEqual(len(r["source_sha256"]), 64)
        self.assertLess(len(json.dumps(r)), 1024)

if __name__ == "__main__":
    unittest.main()
