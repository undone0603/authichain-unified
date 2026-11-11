# AgentZ port of AI Adapt research build 2026-10-07 Typed Decision Gate (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-07-typed-decision-gate.md
import unittest
from agentz.core.decision_gate import (DecisionGate, Rule, build_request, canonical_sha256, passport_gate,
                           PASSPORT_QUESTIONS, workers_ai_transport, premature_rule_check)

STATE = {"source_document": "Cell spec: LFP 280Ah, made in DE", "proposed_record": {"chemistry": "LFP"}}

def fake(answers):
    return lambda req: {"model": "clef", "answers": answers, "usage": {}}

GOOD = {"grounded": {"probability": 0.97}, "premature": {"probability": 0.05},
        "chemistry": {"choice": "lfp", "confidence": 0.93, "probabilities": {"lfp": 0.93}}}

class T(unittest.TestCase):
    def test_approve(self):
        r = passport_gate(fake(GOOD)).evaluate(STATE, PASSPORT_QUESTIONS, ["source_document"])
        self.assertEqual(r.verdict, "approve"); self.assertEqual(r.reasons, [])
    def test_block_ungrounded(self):
        a = dict(GOOD, grounded={"probability": 0.40})
        r = passport_gate(fake(a)).evaluate(STATE, PASSPORT_QUESTIONS)
        self.assertEqual(r.verdict, "block"); self.assertIn("grounded", r.reasons[0])
    def test_abstain_low_confidence_soft(self):
        a = dict(GOOD, chemistry={"choice": "lfp", "confidence": 0.4})
        self.assertEqual(passport_gate(fake(a)).evaluate(STATE, PASSPORT_QUESTIONS).verdict, "abstain")
    def test_abstain_unstated_choice(self):
        a = dict(GOOD, chemistry={"choice": "unstated", "confidence": 0.9})
        self.assertEqual(passport_gate(fake(a)).evaluate(STATE, PASSPORT_QUESTIONS).verdict, "abstain")
    def test_missing_evidence_skips_model(self):
        calls = []
        g = passport_gate(lambda req: calls.append(req) or {"answers": GOOD})
        r = g.evaluate({"proposed_record": {}}, PASSPORT_QUESTIONS, ["source_document"])
        self.assertEqual(r.verdict, "missing_evidence"); self.assertEqual(calls, [])
    def test_transport_error_never_passes(self):
        def boom(req): raise TimeoutError("30s")
        r = passport_gate(boom).evaluate(STATE, PASSPORT_QUESTIONS)
        self.assertEqual(r.verdict, "abstain"); self.assertIn("TimeoutError", r.reasons[0])
    def test_missing_answer_abstains(self):
        a = {k: v for k, v in GOOD.items() if k != "chemistry"}
        self.assertEqual(passport_gate(fake(a)).evaluate(STATE, PASSPORT_QUESTIONS).verdict, "abstain")
    def test_build_request_validates(self):
        with self.assertRaises(ValueError): build_request("s", {"q": {"type": "freeform"}})
        with self.assertRaises(ValueError): build_request("s", {"q": {"type": "choice"}})
    def test_sha_is_canonical(self):
        self.assertEqual(canonical_sha256({"b": 1, "a": 2}), canonical_sha256({"a": 2, "b": 1}))
    def test_receipt_shape(self):
        r = passport_gate(fake(GOOD)).evaluate(STATE, PASSPORT_QUESTIONS)
        rc = r.receipt("passport-bot", "passport_publish", "dpp:battery:123")
        self.assertEqual(rc["verdict"], "approved"); self.assertEqual(len(rc["checks"]["request_sha256"]), 64)
        self.assertNotIn("receipt_sha256", rc); self.assertNotIn("prev_sha256", rc)
        b = passport_gate(fake(dict(GOOD, grounded={"probability": 0.1}))).evaluate(STATE, PASSPORT_QUESTIONS)
        self.assertEqual(b.receipt("x", "y", "z")["verdict"], "abstained")
    def test_workers_ai_transport_mocked(self):
        seen = {}
        def post(url, headers, body):
            seen.update(url=url, auth=headers["Authorization"], body=body)
            return {"success": True, "result": {"answers": GOOD}}
        t = workers_ai_transport("acct123", "tok", http_post=post)
        r = DecisionGate(t, [Rule("grounded", min_true=0.85)]).evaluate(STATE, PASSPORT_QUESTIONS)
        self.assertEqual(r.verdict, "approve")
        self.assertTrue(seen["url"].endswith("/accounts/acct123/ai/run/@cf/cloudflare/clef"))
        self.assertEqual(seen["auth"], "Bearer tok"); self.assertEqual(seen["body"]["model"], "clef")
    def test_premature_helper(self):
        self.assertTrue(premature_rule_check(GOOD))
        self.assertFalse(premature_rule_check({"premature": {"probability": 0.8}}))

if __name__ == "__main__":
    unittest.main()
