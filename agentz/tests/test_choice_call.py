# AgentZ port of AI Adapt research build 2026-11-22 ChoiceCall (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-22-choicecall-no-invented-args.md
import re, unittest
from agentz.core.choice_call import (Param, Tool, ChoiceCaller, candidate_values, compile_tool_question,
                        provenance_ok, DECLINE, NOT_STATED)

BID = r"BAT-[A-Z0-9]{6}"
TOOLS = [
    Tool("record_capacity", "record rated capacity for a battery passport", [
        Param("battery_id", "string", pattern=BID),
        Param("capacity_kwh", "number"),
        Param("chemistry", "enum", enum=["LFP", "NMC", "NCA", "LTO"]),
        Param("recycled", "bool", required=False)]),
    Tool("lookup_passport", "look up a battery passport", [Param("battery_id", "string", pattern=BID)]),
]

def keyword_mock(q):
    """Deterministic stand-in for a one-pass decision model."""
    req = q.prompt.split("\n")[0].lower()
    if q.key == "tool":
        if "capacity" in req or "kwh" in req: return q.options.index("record_capacity")
        if "look up" in req or "find" in req: return q.options.index("lookup_passport")
        return q.options.index(DECLINE)
    for i, o in enumerate(q.options):
        if o == NOT_STATED: continue
        if o in ("true", "false"):
            if "recycled" in req: return q.options.index("true" if "not recycled" not in req else "false")
            continue
        if o.lower() in req: return i
    return q.options.index(NOT_STATED)

class TestCompiler(unittest.TestCase):
    def test_number_options_come_only_from_request(self):
        opts = candidate_values("capacity 75.5 kWh, 2 modules", Param("c", "number"))
        self.assertEqual(opts, ["75.5", "2", NOT_STATED])
    def test_enum_options_come_from_schema(self):
        p = TOOLS[0].params[2]
        self.assertEqual(candidate_values("anything", p), ["LFP", "NMC", "NCA", "LTO", NOT_STATED])
    def test_string_options_respect_pattern(self):
        opts = candidate_values("ids BAT-AB12CD and BAT-xx", TOOLS[1].params[0])
        self.assertEqual(opts, ["BAT-AB12CD", NOT_STATED])
    def test_tool_question_always_offers_decline(self):
        self.assertIn(DECLINE, compile_tool_question("hi", TOOLS).options)

class TestCaller(unittest.TestCase):
    def setUp(self): self.c = ChoiceCaller(TOOLS, keyword_mock)
    def test_full_call(self):
        r = self.c.call("Record capacity 75.5 kWh for BAT-AB12CD, chemistry LFP, recycled cells")
        self.assertEqual(r.status, "CALL")
        self.assertEqual(r.args, {"battery_id": "BAT-AB12CD", "capacity_kwh": 75.5,
                                  "chemistry": "LFP", "recycled": True})
    def test_missing_required_is_asked_not_invented(self):
        r = self.c.call("Record capacity for BAT-AB12CD, chemistry NMC")
        self.assertEqual(r.status, "NEEDS_INPUT")
        self.assertEqual(r.missing, ["capacity_kwh"])
        self.assertNotIn("capacity_kwh", r.args)
    def test_off_topic_declines(self):
        r = self.c.call("What's the weather in Lisbon?")
        self.assertEqual(r.status, "DECLINED"); self.assertIsNone(r.tool)
    def test_lookup(self):
        r = self.c.call("Look up BAT-ZZ9911")
        self.assertEqual((r.status, r.args), ("CALL", {"battery_id": "BAT-ZZ9911"}))
    def test_out_of_range_decision_rejected(self):
        c = ChoiceCaller(TOOLS, lambda q: 99)
        with self.assertRaises(ValueError): c.call("Look up BAT-ZZ9911")
    def test_adversarial_model_cannot_invent(self):
        # a model that always picks the first non-NOT_STATED option still only yields request spans
        c = ChoiceCaller(TOOLS, lambda q: 0)
        r = c.call("capacity 60 kWh for BAT-QQ1234")
        for v in r.args.values():
            self.assertTrue(str(v) in "capacity 60 kWh for BAT-QQ1234" or v in ["LFP","NMC","NCA","LTO"] or isinstance(v, bool))
    def test_provenance_check_flags_invented_value(self):
        self.assertFalse(provenance_ok("Look up BAT-ZZ9911", TOOLS[1], {"battery_id": "BAT-INVENT"}))
    def test_ledger_chain_and_tamper(self):
        self.c.call("Look up BAT-ZZ9911"); self.c.call("hello")
        self.assertTrue(self.c.verify_ledger())
        self.c.ledger[0]["tool"] = "record_capacity"
        self.assertFalse(self.c.verify_ledger())

if __name__ == "__main__": unittest.main()
