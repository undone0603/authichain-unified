# AgentZ port of AI Adapt research build 2026-11-19 ResolveGate (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-19-resolvegate-noise-aware-selection.md
import random, unittest
from agentz.core.resolve_gate import (decide, noise_floor, paired_bootstrap_ci, sign_test_p, rank_methods,
                         Champion, ACCEPT, REJECT, INCONCLUSIVE)

def runs(base, n_items=60, reps=3, noise=0.0, seed=1):
    """Simulated per-item 0/1 scores: item i passes with prob base[i] (+ run noise)."""
    rng = random.Random(seed)
    out = []
    for _ in range(reps):
        out.append([1.0 if rng.random() < min(1, max(0, p + rng.uniform(-noise, noise))) else 0.0 for p in base])
    return out

class T(unittest.TestCase):
    def setUp(self):
        r = random.Random(0)
        self.base = [r.uniform(0.2, 0.8) for _ in range(60)]

    def test_clear_improvement_accepted(self):
        champ = runs(self.base, seed=1)
        cand = runs([min(1, p + 0.35) for p in self.base], seed=2)
        self.assertEqual(decide(champ, cand).verdict, ACCEPT)

    def test_clear_regression_rejected(self):
        champ = runs(self.base, seed=1)
        cand = runs([max(0, p - 0.35) for p in self.base], seed=2)
        self.assertEqual(decide(champ, cand).verdict, REJECT)

    def test_same_artifact_is_inconclusive(self):
        champ = runs(self.base, seed=1); cand = runs(self.base, seed=7)
        self.assertEqual(decide(champ, cand).verdict, INCONCLUSIVE)

    def test_small_gain_inside_noise_not_accepted(self):
        champ = runs(self.base, seed=1, noise=0.2)
        cand = runs([min(1, p + 0.02) for p in self.base], seed=3, noise=0.2)
        self.assertNotEqual(decide(champ, cand).verdict, ACCEPT)

    def test_too_few_items_inconclusive(self):
        champ = runs(self.base[:10], seed=1); cand = runs([1.0] * 10, seed=2)
        d = decide(champ, cand)
        self.assertEqual(d.verdict, INCONCLUSIVE); self.assertIn("need 30", d.reason)

    def test_noise_floor_needs_replicates(self):
        with self.assertRaises(ValueError):
            noise_floor([[1.0, 0.0]])

    def test_noise_floor_zero_for_identical_runs(self):
        self.assertEqual(noise_floor([[1, 0, 1], [1, 0, 1]]), 0.0)

    def test_mismatched_items_raise(self):
        with self.assertRaises(ValueError):
            decide([[1, 0], [1, 0]], [[1, 0, 1], [1, 0, 1]])

    def test_bootstrap_deterministic_and_ordered(self):
        diffs = [0.1, -0.2, 0.3, 0.0, 0.5]
        a = paired_bootstrap_ci(diffs, seed=4); b = paired_bootstrap_ci(diffs, seed=4)
        self.assertEqual(a, b); self.assertLessEqual(a[0], a[1])

    def test_sign_test(self):
        self.assertAlmostEqual(sign_test_p([1] * 10), 2 / 1024)
        self.assertEqual(sign_test_p([0, 0]), 1.0)

    def test_rank_methods_ties_close_scores(self):
        res = {"A": runs(self.base, seed=1), "B": runs(self.base, seed=5),
               "C": runs([max(0, p - 0.4) for p in self.base], seed=6)}
        tiers = rank_methods(res)
        self.assertEqual(sorted(tiers[0]), ["A", "B"])
        self.assertEqual(tiers[1], ["C"])

    def test_champion_accumulates_and_ledger_chains(self):
        c = Champion("prompt-v1", runs(self.base, seed=1))
        c.propose("prompt-v2-noise", runs(self.base, seed=9))
        self.assertEqual(c.artifact_id, "prompt-v1")
        c.propose("prompt-v3", runs([min(1, p + 0.35) for p in self.base], seed=2))
        self.assertEqual(c.artifact_id, "prompt-v3")
        self.assertEqual(c.ledger[1]["prev"], c.ledger[0]["sha256"])
        self.assertEqual(len(c.ledger), 2)

if __name__ == "__main__":
    unittest.main()
