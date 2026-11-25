# AgentZ port of AI Adapt research build 2026-11-10 DisclosureGate (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-10-disclosuregate-fraud-modes.md
import unittest
from agentz.core.disclosure_gate import Fact, check, facts_from_rows, keyword_topics, LAW_PREAMBLE

VOCAB = {"testing": ["test", "tested", "testing", "verified"],
         "carbon": ["carbon", "co2", "footprint"],
         "recall": ["safety", "recall"]}

FUNDED = Fact("f1", "Cell testing was funded by the manufacturer.", frozenset({"testing"}),
              must_disclose=True,
              forbidden_claims=(r"\bindependent(ly)?\s+(lab|test\w*|verified)",),
              disclosure_patterns=(r"funded by|manufacturer[- ]funded|commissioned by",))
PROBE = Fact("f2", "A regulator is reviewing a thermal-safety complaint.", frozenset({"recall"}),
             must_disclose=True, disclosure_patterns=(r"under review|investigation|complaint",))
CARBON = Fact("f3", "Carbon footprint is self-declared, not third-party verified.", frozenset({"carbon"}),
              forbidden_claims=(r"third[- ]party verified carbon",))


class T(unittest.TestCase):
    def test_clean_message_passes(self):
        d = check("Our pack ships in March.", [FUNDED, PROBE], "act", topic_vocab=VOCAB)
        self.assertEqual(d.verdict, "PASS")

    def test_misrepresentation_detected(self):
        d = check("Independently tested cells, funded by the manufacturer.", [FUNDED], "act", topic_vocab=VOCAB)
        self.assertEqual([v.kind for v in d.violations], ["MISREPRESENTATION"])

    def test_concealment_detected_when_topic_relevant(self):
        d = check("Cells were tested to IEC 62660.", [FUNDED], "draft", topic_vocab=VOCAB)
        self.assertEqual(d.verdict, "REVISE")
        self.assertEqual(d.required_disclosures, [FUNDED.statement])

    def test_disclosure_satisfies(self):
        d = check("Cells were tested, funded by the manufacturer.", [FUNDED], "act", topic_vocab=VOCAB)
        self.assertEqual(d.verdict, "PASS")

    def test_irrelevant_fact_not_required(self):
        d = check("Cells were tested, funded by the manufacturer.", [FUNDED, PROBE], "act", topic_vocab=VOCAB)
        self.assertEqual(d.verdict, "PASS")

    def test_safety_topic_triggers_probe_disclosure(self):
        d = check("Safety is our priority.", [PROBE], "act", topic_vocab=VOCAB)
        self.assertEqual(d.verdict, "HOLD")
        self.assertEqual(d.violations[0].kind, "CONCEALMENT")

    def test_autonomy_ladder(self):
        msg = "Third-party verified carbon footprint."
        self.assertEqual(check(msg, [CARBON], "advise", topic_vocab=VOCAB).verdict, "WARN")
        self.assertEqual(check(msg, [CARBON], "draft", topic_vocab=VOCAB).verdict, "REVISE")
        self.assertEqual(check(msg, [CARBON], "act", topic_vocab=VOCAB).verdict, "HOLD")

    def test_mocked_llm_topic_extractor(self):
        d = check("Lab results look great.", [FUNDED], "act", topic_extractor=lambda m: ["testing"])
        self.assertEqual(d.verdict, "HOLD")

    def test_extractor_failure_fails_closed(self):
        def boom(_): raise TimeoutError("llm timeout")
        d = check("Hello", [FUNDED], "draft", topic_extractor=boom)
        self.assertEqual(d.verdict, "HOLD")
        self.assertEqual(d.violations[0].kind, "UNMEASURABLE")

    def test_bad_autonomy_rejected(self):
        with self.assertRaises(ValueError):
            check("x", [], "autopilot")

    def test_receipt_is_deterministic(self):
        a = check("Cells were tested.", [FUNDED], "draft", topic_vocab=VOCAB).receipt
        b = check("Cells were tested.", [FUNDED], "draft", topic_vocab=VOCAB).receipt
        self.assertEqual(a, b)
        self.assertEqual(a["violations"], [["CONCEALMENT", "f1"]])

    def test_facts_from_rows_and_keyword_topics(self):
        fs = facts_from_rows([{"id": "r1", "statement": "s", "topics": ["carbon"], "must_disclose": True,
                               "disclosure_patterns": ["self-declared"]}])
        self.assertEqual(fs[0].topics, frozenset({"carbon"}))
        self.assertEqual(keyword_topics("CO2 footprint", VOCAB), {"carbon"})
        self.assertIn("material fact", LAW_PREAMBLE)


if __name__ == "__main__":
    unittest.main()
