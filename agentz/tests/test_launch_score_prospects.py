"""launch_score_prospects scores only real input and never reports a sample score."""
import csv
import os
import tempfile
import unittest
from unittest.mock import patch

from agentz.core.modes import ExecutionContext, Mode
from agentz.workflows.handlers.launch import score_prospects

FULL = {"icp_fit": 25, "pain_intensity": 20, "authichain_fit": 20,
        "buying_authority": 15, "deployment_ease": 10, "revenue_potential": 10}


def ctx(**params):
    return ExecutionContext(mode=Mode.DRY_RUN, workflow_id="launch_score_prospects",
                            verbose=False, parameters=params)


class ScoreProspectsTests(unittest.TestCase):
    def test_no_source_reports_zero_not_a_sample(self):
        with patch.dict(os.environ, {"AGENTZ_PROSPECTS_CSV": ""}):
            out = score_prospects.run(ctx())
        self.assertIn("0 prospects scored", out)
        self.assertNotIn("Sample", out)

    def test_scores_and_ranks_payload_prospects(self):
        low = {**FULL, "icp_fit": 5, "pain_intensity": 5, "authichain_fit": 5}
        out = score_prospects.run(ctx(prospects=[
            {"name": "Low Co", **low}, {"name": "Top Co", **FULL}]))
        self.assertIn("scored 2 of 2 prospects from run parameters", out)
        self.assertIn("1 qualified: Top Co=100", out)
        self.assertNotIn("Low Co=", out)

    def test_incomplete_rows_are_not_guessed(self):
        partial = {k: v for k, v in FULL.items() if k != "buying_authority"}
        out = score_prospects.run(ctx(prospects=[{"name": "Gap Co", **partial}]))
        self.assertIn("scored 0 of 1", out)
        self.assertIn("1 incomplete (missing rubric fields): Gap Co", out)

    def test_caps_and_floors_each_factor(self):
        wild = {**FULL, "icp_fit": 999, "pain_intensity": -7}
        out = score_prospects.run(ctx(prospects=[{"name": "Wild Co", **wild}]))
        self.assertIn("Wild Co=80", out)  # icp capped at 25, pain floored at 0

    def test_non_finite_values_are_incomplete_not_fatal(self):
        out = score_prospects.run(ctx(prospects=[
            {"name": "Inf Co", **{**FULL, "icp_fit": "inf"}},
            {"name": "Huge Co", **{**FULL, "pain_intensity": "1e309"}},
            {"name": "NaN Co", **{**FULL, "authichain_fit": "nan"}},
            {"name": "Good Co", **FULL}]))
        self.assertIn("scored 1 of 4", out)
        self.assertIn("Good Co=100", out)
        self.assertIn("3 incomplete", out)

    def test_reads_csv_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "prospects.csv")
            with open(path, "w", newline="", encoding="utf-8") as fh:
                w = csv.DictWriter(fh, fieldnames=["name", *FULL])
                w.writeheader()
                w.writerow({"name": "CSV Co", **FULL})
                w.writerow({"name": "Blank Co", **{k: "" for k in FULL}})
            with patch.dict(os.environ, {"AGENTZ_PROSPECTS_CSV": path}):
                out = score_prospects.run(ctx())
        self.assertIn("scored 1 of 2 prospects from CSV prospects.csv", out)
        self.assertIn("CSV Co=100", out)
        self.assertIn("1 incomplete", out)


if __name__ == "__main__":
    unittest.main()
