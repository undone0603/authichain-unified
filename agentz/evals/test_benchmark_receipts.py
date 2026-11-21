"""Unit tests for the offline, deterministic AgentZ evaluation scorer."""
import copy
import importlib.util
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location("benchmark_receipts", Path(__file__).resolve().parents[0] / "benchmark_receipts.py")
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


def sample(category, variant, task_id="task", passed=True, cost=0.1, violations=0):
    return {
        "category": category, "variant": variant, "task_id": task_id,
        "seed": "seed-1", "source_sha": ("a" if variant == "baseline" else "b") * 40,
        "evidence_sha256": "f" * 64,
        "passed": passed, "latency_ms": 100, "cost_usd": cost,
        "security_violations": violations,
    }


def complete_suite():
    result = []
    for i, category in enumerate(module.CATEGORIES):
        result += [sample(category, "baseline", passed=i != 0), sample(category, "candidate", passed=True)]
    return result


class BenchmarkTests(unittest.TestCase):
    def test_reproducible_and_eligible(self):
        rows = complete_suite()
        output = module.summarize(rows)
        self.assertEqual(output, module.summarize(list(reversed(rows))))
        self.assertEqual(output["decision"], "eligible_for_independent_review")
        self.assertEqual(output["pass_gains"], 1)
        self.assertFalse(output["deployment_authorized"])
        self.assertIn("NOT_PERFORMED", output["evidence_verification"])

    def test_reject_unpaired(self):
        with self.assertRaisesRegex(ValueError, "unpaired"):
            module.summarize(complete_suite()[1:])

    def test_reject_duplicate(self):
        rows = complete_suite()
        with self.assertRaisesRegex(ValueError, "duplicate"):
            module.summarize(rows + [copy.deepcopy(rows[0])])

    def test_security_hold(self):
        rows = complete_suite()
        rows[1]["security_violations"] = 1
        self.assertEqual(module.summarize(rows)["decision"], "regression_or_security_hold")

    def test_pass_regression_hold(self):
        rows = complete_suite()
        rows[3]["passed"] = False
        self.assertEqual(module.summarize(rows)["decision"], "regression_or_security_hold")

    def test_cost_regression_hold(self):
        rows = complete_suite()
        for row in rows:
            if row["variant"] == "candidate":
                row["cost_usd"] = 2
        self.assertEqual(module.summarize(rows)["decision"], "cost_regression_hold")

    def test_invalid_negative_nan_or_bool_numeric(self):
        for bad in (-1, float("nan"), True):
            rows = complete_suite()
            rows[0]["cost_usd"] = bad
            with self.assertRaises(ValueError):
                module.summarize(rows)

    def test_insufficient_coverage(self):
        rows = [r for r in complete_suite() if r["category"] != "long_horizon"]
        self.assertEqual(module.summarize(rows)["decision"], "insufficient_category_coverage")

    def test_requires_pinned_source(self):
        rows = complete_suite()
        rows[1]["source_sha"] = "c" * 40
        with self.assertRaisesRegex(ValueError, "pinned"):
            module.summarize(rows)


if __name__ == "__main__":
    unittest.main()
