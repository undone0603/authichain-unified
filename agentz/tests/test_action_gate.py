# AgentZ port of AI Adapt research build 2026-10-01 Action Gate (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-01-action-gate.md
"""Offline tests for action_gate (no network). Run: python3 -m unittest -v"""
import itertools
import json
import unittest

from agentz.core.action_gate import gate, is_side_effecting


def scripted_generator(outputs):
    it = itertools.cycle(outputs)
    return lambda system, user: next(it)


def prefer_containing(word):
    """Verifier that prefers the candidate containing `word`, else A."""
    def v(system, user):
        a = user.split("CANDIDATE A:\n")[1].split("\n\nCANDIDATE B:")[0]
        b = user.split("CANDIDATE B:\n")[1]
        w = "B" if (word in b and word not in a) else "A"
        return json.dumps({"winner": w, "reason": f"prefers '{word}'"})
    return v


class GateTests(unittest.TestCase):
    def test_read_only_skips_verification(self):
        d = gate("bot", "list rows", scripted_generator(["select 1"]),
                 lambda s, u: (_ for _ in ()).throw(AssertionError("verifier called")),
                 n=4, action_hint="read table")
        self.assertFalse(d.gated)
        self.assertEqual(d.chosen, "select 1")
        self.assertEqual(d.comparisons, [])

    def test_side_effect_picks_safe_candidate(self):
        gen = scripted_generator(["rm -rf /data", "DRY-RUN deploy", "deploy --force", "deploy"])
        d = gate("bot", "deploy the worker", gen, prefer_containing("DRY-RUN"),
                 n=4, action_hint="deploy")
        self.assertTrue(d.gated)
        self.assertEqual(d.chosen, "DRY-RUN deploy")
        self.assertEqual(len(d.comparisons), 3)  # N-1 knockout comparisons

    def test_duplicates_collapsed(self):
        d = gate("bot", "s", scripted_generator(["x"]), prefer_containing("x"),
                 n=4, action_hint="send email")
        self.assertEqual(d.candidates, ["x"])
        self.assertEqual(d.chosen, "x")

    def test_verifier_failure_abstains(self):
        gen = scripted_generator(["a", "b"])
        d = gate("bot", "s", gen, lambda s, u: "not json", n=2, action_hint="send")
        self.assertTrue(d.abstained)
        self.assertIsNone(d.chosen)
        self.assertIn("verifier error", d.error)

    def test_receipt_is_tamper_evident(self):
        gen = scripted_generator(["a", "b", "c"])
        d = gate("bot", "s", gen, prefer_containing("c"), n=3, action_hint="write")
        self.assertEqual(len(d.receipt_sha256), 64)
        self.assertTrue(d.verify_seal())
        d.chosen = "tampered"
        self.assertFalse(d.verify_seal())

    def test_hint_classifier(self):
        self.assertTrue(is_side_effecting("send email"))
        self.assertTrue(is_side_effecting("Deploy worker"))
        self.assertFalse(is_side_effecting("read logs"))


if __name__ == "__main__":
    unittest.main()
