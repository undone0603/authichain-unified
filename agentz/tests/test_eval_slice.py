# AgentZ port of AI Adapt research build 2026-11-06 EvalSlice (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-06-evalslice-eval-compression.md
import random, unittest
from agentz.core.eval_slice import best_of_random, validate, estimate, tail_risk, subset_errors

def synth(models, n=200, seed=7):
    """Mock eval matrix: model skill + item difficulty -> 0/1 correctness."""
    rng = random.Random(seed)
    diff = [rng.random() for _ in range(n)]
    out = {}
    for m, skill in models.items():
        r = random.Random(sum(map(ord, m)))
        out[m] = [1.0 if r.random() < max(0.0, min(1.0, skill + 0.5 - d)) else 0.0 for d in diff]
    return out

FIT = synth({"a": .2, "b": .35, "c": .5, "d": .65, "e": .8})
HOLD = {k: v for k, v in synth({"a": .2, "b": .35, "c": .5, "d": .65, "e": .8, "f": .42, "g": .71}).items() if k in "fg"}

class T(unittest.TestCase):
    def test_best_beats_typical_random_worst_case(self):
        sl = best_of_random(FIT, k=30, draws=400)
        rng = random.Random(3)
        typical = sorted(max(subset_errors(FIT, rng.sample(range(200), 30))) for _ in range(200))[100]
        self.assertLess(sl.max_err, typical)

    def test_deterministic_with_seed(self):
        self.assertEqual(best_of_random(FIT, 20, seed=5).items, best_of_random(FIT, 20, seed=5).items)

    def test_slice_size(self):
        self.assertEqual(len(best_of_random(FIT, 25).items), 25)

    def test_holdout_validation_trusts_good_slice(self):
        sl = validate(best_of_random(FIT, 60, draws=400), HOLD, tolerance=0.08)
        self.assertTrue(sl.trusted)

    def test_untrusted_slice_refuses_estimate(self):
        sl = validate(best_of_random(FIT, 5), HOLD, tolerance=0.0)
        self.assertFalse(sl.trusted)
        with self.assertRaises(RuntimeError):
            estimate(sl, [1.0] * 5)

    def test_estimate_is_slice_mean(self):
        sl = best_of_random(FIT, 4)
        self.assertAlmostEqual(estimate(sl, [1, 0, 1, 1]), 0.75)

    def test_tail_risk_shrinks_with_k(self):
        self.assertGreater(tail_risk(FIT, 10, 0.1), tail_risk(FIT, 80, 0.1))

    def test_rejects_ragged_matrix(self):
        with self.assertRaises(ValueError):
            best_of_random({"a": [1, 0], "b": [1]}, 1)

    def test_rejects_out_of_range_scores(self):
        with self.assertRaises(ValueError):
            best_of_random({"a": [1.5, 0]}, 1)

    def test_rejects_bad_k(self):
        with self.assertRaises(ValueError):
            best_of_random(FIT, 0)

    def test_estimate_length_mismatch(self):
        with self.assertRaises(ValueError):
            estimate(best_of_random(FIT, 4), [1, 0])

if __name__ == "__main__":
    unittest.main()
