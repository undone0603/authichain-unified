# AgentZ port of AI Adapt research build 2026-10-30 DiffGauge (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-30-diffgauge-eval-coverage.md
import unittest, random
from agentz.core import diff_gauge as dg


class TestDDM(unittest.TestCase):
    def test_uniform_grid_near_zero(self):
        z = [(i + 0.5) / 100 for i in range(100)]
        self.assertLess(dg.ddm(z), 0.01)

    def test_point_mass_at_zero(self):
        # W1(delta_0, Unif) = 0.5
        self.assertAlmostEqual(dg.ddm([0.0] * 10), 0.5, places=2)

    def test_easy_heavy_worse_than_spread(self):
        easy = [0.05, 0.1, 0.1, 0.15, 0.2, 0.9]
        spread = [0.1, 0.25, 0.4, 0.6, 0.75, 0.9]
        self.assertGreater(dg.ddm(easy), dg.ddm(spread))

    def test_custom_target_identical_is_zero(self):
        s = [0.2, 0.4, 0.6]
        self.assertAlmostEqual(dg.ddm(s, target=s), 0.0, places=6)

    def test_rejects_out_of_range(self):
        with self.assertRaises(ValueError):
            dg.ddm([0.5, 1.2])


class TestGaps(unittest.TestCase):
    def test_max_gap_with_bounds(self):
        self.assertAlmostEqual(dg.max_gap([0.1, 0.2, 0.9]), 0.7)

    def test_gaps_sorted_desc(self):
        g = dg.coverage_gaps([0.1, 0.5, 0.55])
        widths = [x["width"] for x in g]
        self.assertEqual(widths, sorted(widths, reverse=True))

    def test_no_bounds(self):
        self.assertAlmostEqual(dg.max_gap([0.1, 0.2, 0.9], include_bounds=False), 0.7)
        self.assertAlmostEqual(dg.max_gap([0.4, 0.5], include_bounds=False), 0.1)


class TestRankFlip(unittest.TestCase):
    def test_guard(self):
        self.assertTrue(dg.rank_flip_safe(0.10, 1.0, 0.05))
        self.assertFalse(dg.rank_flip_safe(0.04, 1.0, 0.05))


class TestIRT(unittest.TestCase):
    def test_harder_items_rank_higher(self):
        random.seed(7)
        true_b = [-2.0, -1.0, 0.0, 1.0, 2.0]
        abilities = [-1.5, -0.5, 0.0, 0.5, 1.5, 2.5, -2.5, 1.0]
        matrix = []
        for th in abilities:
            for _ in range(5):  # 5 noisy replicate "runs" per model
                matrix.append([1 if random.random() < dg._sigmoid(th - b) else 0 for b in true_b])
        z = dg.estimate_difficulty(matrix)
        self.assertEqual(sorted(range(5), key=lambda i: z[i]), [0, 1, 2, 3, 4])
        self.assertAlmostEqual(min(z), 0.0)
        self.assertAlmostEqual(max(z), 1.0)

    def test_degenerate_all_equal(self):
        self.assertEqual(dg.estimate_difficulty([[1, 1], [1, 1]]), [0.5, 0.5])

    def test_ragged_raises(self):
        with self.assertRaises(ValueError):
            dg.estimate_difficulty([[1, 0], [1]])


class TestBenchFill(unittest.TestCase):
    def test_plan_uses_mock_rewriter(self):
        calls = []

        def mock_llm(seed, target):
            calls.append((seed, target))
            return f"REWRITE[{seed}]@{target:.2f}"

        z = [0.05, 0.1, 0.15, 0.95]
        items = ["cathode chemistry?", "rated capacity?", "manufacturer id?", "carbon footprint class?"]
        plan = dg.benchfill_plan(z, items, k=2, rewriter=mock_llm)
        self.assertEqual(len(plan), 2)
        self.assertEqual(len(calls), 2)
        self.assertAlmostEqual(plan[0]["gap_width"], 0.8)
        self.assertTrue(all(p["status"] == "PROPOSED" for p in plan))
        self.assertIn("REWRITE", plan[0]["proposed_item"])

    def test_plan_without_rewriter(self):
        plan = dg.benchfill_plan([0.2, 0.8], ["a", "b"], k=1)
        self.assertIsNone(plan[0]["proposed_item"])

    def test_length_mismatch(self):
        with self.assertRaises(ValueError):
            dg.benchfill_plan([0.2], ["a", "b"])


class TestAudit(unittest.TestCase):
    def test_end_to_end_passport_eval(self):
        # 4 extractor configs x 6 battery-passport fields (1 = field extracted correctly)
        matrix = [[1, 1, 1, 1, 0, 0],
                  [1, 1, 1, 0, 0, 0],
                  [1, 1, 1, 1, 1, 0],
                  [1, 1, 0, 0, 0, 0]]
        items = ["manufacturer", "battery_category", "chemistry", "rated_capacity",
                 "carbon_footprint", "recycled_content_share"]
        r = dg.audit(matrix, items, k=2, rewriter=lambda s, t: f"{s}-variant")
        self.assertEqual(r["n_items"], 6)
        self.assertTrue(0.0 <= r["ddm_w1"] <= 0.5)
        self.assertEqual(len(r["benchfill"]), 2)
        self.assertEqual(r["difficulty"].index(1.0), 5)  # hardest field


if __name__ == "__main__":
    unittest.main()

