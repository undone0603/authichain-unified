# AgentZ port of AI Adapt research build 2026-10-31 CiteCheck (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-31-citecheck-evidence-gate.md
import json, unittest
from unittest import mock
from agentz.core import cite_check as cc

DOCS = {
    "spec:cell-7": "Rated capacity: 72 Ah. Chemistry: LFP. Manufacturer: Example Cells GmbH.",
    "ledger:tx-91": "From 0xabc to 0xdef amount 4.2 ETH block 18000001",
}

class T(unittest.TestCase):
    def setUp(self):
        self.r = cc.RecordingRetriever(lambda rid: DOCS[rid])

    def test_supported(self):
        self.r("spec:cell-7")
        rep = cc.check(self.r.trace, [{"claim_id": "c1", "text": "capacity 72Ah",
              "cites": [{"record_id": "spec:cell-7", "quote": "rated capacity: 72 Ah"}]}])
        self.assertEqual(rep.results[0].verdict, cc.SUPPORTED); self.assertEqual(rep.gate, "pass")

    def test_unretrieved_overconfidence(self):
        rep = cc.check(self.r.trace, [{"claim_id": "c1", "text": "x",
              "cites": [{"record_id": "ledger:tx-91", "quote": "4.2 ETH"}]}])
        self.assertEqual(rep.results[0].verdict, cc.UNRETRIEVED); self.assertEqual(rep.gate, "fail")

    def test_quote_miss(self):
        self.r("spec:cell-7")
        rep = cc.check(self.r.trace, [{"claim_id": "c1", "text": "NMC",
              "cites": [{"record_id": "spec:cell-7", "quote": "Chemistry: NMC"}]}])
        self.assertEqual(rep.results[0].verdict, cc.QUOTE_MISS)

    def test_hash_match_and_mismatch(self):
        self.r("ledger:tx-91")
        good = cc.sha256(DOCS["ledger:tx-91"])
        rep = cc.check(self.r.trace, [
            {"claim_id": "a", "text": "", "cites": [{"record_id": "ledger:tx-91", "sha256": good}]},
            {"claim_id": "b", "text": "", "cites": [{"record_id": "ledger:tx-91", "sha256": "0"*64}]}])
        self.assertEqual([x.verdict for x in rep.results], [cc.SUPPORTED, cc.HASH_MISMATCH])

    def test_uncited(self):
        rep = cc.check([], [{"claim_id": "c", "text": "trust me", "cites": []}])
        self.assertEqual(rep.results[0].verdict, cc.UNCITED)

    def test_worst_cite_wins(self):
        self.r("spec:cell-7")
        rep = cc.check(self.r.trace, [{"claim_id": "c", "text": "", "cites": [
            {"record_id": "spec:cell-7", "quote": "LFP"}, {"record_id": "ledger:tx-91"}]}])
        self.assertEqual(rep.results[0].verdict, cc.UNRETRIEVED)

    def test_threshold_gate(self):
        self.r("spec:cell-7")
        claims = [{"claim_id": "ok", "text": "", "cites": [{"record_id": "spec:cell-7", "quote": "LFP"}]},
                  {"claim_id": "bad", "text": "", "cites": []}]
        self.assertEqual(cc.check(self.r.trace, claims, min_support=0.5).gate, "pass")
        self.assertEqual(cc.check(self.r.trace, claims).gate, "fail")

    def test_empty_claims_fail_closed(self):
        self.assertEqual(cc.check([], []).gate, "fail")

    def test_mocked_llm_extraction_end_to_end(self):
        llm = mock.Mock(return_value=json.dumps([
            {"claim_id": "capacity", "text": "72 Ah", "cites": [{"record_id": "spec:cell-7", "quote": "72 Ah"}]},
            {"claim_id": "recycled_content", "text": "16% cobalt", "cites": [{"record_id": "spec:recycled"}]}]))
        self.r("spec:cell-7")
        rep = cc.check(self.r.trace, json.loads(llm("extract")))
        self.assertEqual({x.claim_id: x.verdict for x in rep.results},
                         {"capacity": cc.SUPPORTED, "recycled_content": cc.UNRETRIEVED})
        self.assertAlmostEqual(rep.support_rate, 0.5)
        self.assertIn('"gate": "fail"', rep.to_json())

if __name__ == "__main__":
    unittest.main()
