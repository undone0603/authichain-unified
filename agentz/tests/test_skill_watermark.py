# AgentZ port of AI Adapt research build 2026-10-15 Skillmark (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-15-skillmark-skill-watermark.md
import random, re, unittest, zlib
from agentz.core import skill_watermark as sm

KEY = b"authichain-test-key-001"
WRONG = b"some-other-key"

SYN = {"use": ["apply", "employ", "utilize"], "check": ["verify", "inspect", "confirm", "validate"],
       "file": ["document", "record"], "make": ["create", "produce", "build"],
       "the": ["the"], "each": ["every"], "first": ["initially", "first"],
       "quickly": ["promptly", "rapidly", "swiftly"], "result": ["outcome", "output"],
       "show": ["display", "present", "surface"], "user": ["person", "operator", "customer"],
       "data": ["information", "records"], "start": ["begin", "commence"], "help": ["assist", "support"],
       "then": ["next", "afterwards"], "find": ["locate", "identify"], "clear": ["plain", "explicit"],
       "short": ["brief", "concise"], "carefully": ["thoroughly", "attentively"], "send": ["deliver", "dispatch"],
       "product": ["item", "good"], "battery": ["battery"], "passport": ["passport"], "label": ["tag", "marker"],
       "record": ["entry", "log"], "every": ["each", "all"], "issue": ["problem", "defect"], "write": ["compose", "draft"]}

def mock_rewriter(sentence, n):
    """Deterministic stand-in for an LLM paraphraser: random synonym swaps."""
    rng = random.Random(zlib.crc32(sentence.encode()))
    outs = []
    for _ in range(n):
        def sub(m):
            w = m.group(0); alts = SYN.get(w.lower())
            if alts and rng.random() < 0.7:
                r = rng.choice(alts); return r.capitalize() if w[0].isupper() else r
            return w
        outs.append(re.sub(r"[A-Za-z]+", sub, sentence))
    outs.append("This candidate drops the protected number")  # must be rejected when atoms differ
    return outs

SKILL = """---
name: dpp-checker
description: Validate a battery passport record.
---
# DPP checker

Use this skill to check each battery passport record before you send it.
First find the product data and check the label quickly.
Then make a short result and show the user a clear issue list.
You MUST keep the `carbon_footprint` field and NEVER drop the 2027-02-18 deadline.
Use the file at https://example.org/schema.json and check every record carefully.
Write the result to the file, then help the user start the next record.
Check each label and show each issue to the user quickly and carefully.
Find the data, make the record, use the label, then send the result.

Start with the passport file and find the battery label first.
Check the data in each record, then show the user the result quickly.
Use a clear label for every product and write a short issue note.
Send each record only after you check the data and the label carefully.
Help the user find the file, then start the check and show the outcome.
Make a short list of every issue and send it to the user.
Use the schema to check each product, then write the result to the record.
First check the label, then find the data, then make the record clear.

```python
assert record["carbon_footprint"] is not None
```
"""

class TestSkillMark(unittest.TestCase):
    def setUp(self):
        self.rep = sm.embed(SKILL, KEY, mock_rewriter, n_candidates=24)

    def test_embed_rewrites_sentences(self):
        self.assertGreater(self.rep.rewritten, 0)
        self.assertGreater(self.rep.sentences, 5)

    def test_watermark_detected_with_key(self):
        self.assertTrue(sm.detect(self.rep.text, KEY)["detected"], sm.detect(self.rep.text, KEY))

    def test_original_not_detected(self):
        self.assertFalse(sm.detect(SKILL, KEY)["detected"])

    def test_wrong_key_not_detected(self):
        self.assertFalse(sm.detect(self.rep.text, WRONG)["detected"])

    def test_protected_content_identical(self):
        self.assertTrue(self.rep.audit["protected_identical"])
        for atom in ["`carbon_footprint`", "2027-02-18", "https://example.org/schema.json", "MUST", "NEVER",
                     'assert record["carbon_footprint"] is not None', "name: dpp-checker"]:
            self.assertIn(atom, self.rep.text)

    def test_quality_gate_rejects_atom_loss(self):
        self.assertGreater(self.rep.rejected_candidates, 0)
        self.assertFalse(sm.quality_ok("Keep 2027-02-18 here.", "Keep the date here."))
        self.assertTrue(sm.quality_ok("Keep 2027-02-18 here.", "Retain 2027-02-18 here."))

    def test_partial_copy_detected_by_window(self):
        big = sm.embed(SKILL * 3, KEY, mock_rewriter, 24).text
        toks = re.findall(r"[A-Za-z][A-Za-z'-]*", big)
        stolen = " ".join(toks[: len(toks) // 2])
        unrelated = ("The quarterly report covers revenue growth across regions and notes "
                     "several hiring plans for the coming year in sales and support teams. ") * 6
        res = sm.detect(unrelated + stolen + " " + unrelated, KEY)
        self.assertTrue(res["detected"], res)

    def test_unrelated_text_not_detected(self):
        text = ("Agents read instructions and act on them in many environments with tools. " * 20)
        self.assertFalse(sm.detect(text, KEY)["detected"])

    def test_sha256_receipt_stable(self):
        again = sm.embed(SKILL, KEY, mock_rewriter, n_candidates=24)
        self.assertEqual(self.rep.sha256, again.sha256)
        self.assertEqual(len(self.rep.sha256), 64)

    def test_short_skill_signal_present_but_below_threshold(self):
        """Documented limit: compact skills (<~150 tokens) raise z but may not clear 4.0."""
        short = SKILL.split("Start with the passport")[0]
        rep = sm.embed(short, KEY, mock_rewriter, 24)
        self.assertGreater(rep.z, sm.score(short, KEY)["z"] + 2.0)

    def test_score_math(self):
        s = sm.score("", KEY)
        self.assertEqual(s["z"], 0.0)

if __name__ == "__main__":
    unittest.main()
