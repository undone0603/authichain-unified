# AgentZ port of AI Adapt research build 2026-10-08 RunningTab (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-08-running-tab.md
import json
import unittest
from agentz.core.running_tab import RunningTab, FinishBlocked, sha256

FILES = {
    "passport/battery_A.txt": "Battery model A. Carbon footprint: 61.2 kg CO2e per kWh. Recycled cobalt share: 16%.",
    "passport/battery_B.txt": "Battery model B. Carbon footprint: 58.9 kg CO2e per kWh.",
    "passport/supplier_audit.pdf.txt": "Supplier audit 2026: cobalt sourced from certified refinery.",
}


def make_tab():
    return RunningTab("task-1", reader=lambda p: FILES[p],
                      lister=lambda d: sorted(k for k in FILES if k.startswith(d)))


class MockAgent:
    """Stands in for the LLM: deterministic, no API calls."""
    def run(self, tab, forget_cobalt=False):
        tab.add_requirement("carbon footprint of battery model A")
        tab.add_requirement("recycled cobalt share of battery model A")
        tab.list_dir("passport/")
        tab.read_file("passport/battery_A.txt")
        v = tab.view("R1")
        tab.resolve("R1", [v["excerpts"][0]["id"]], "61.2 kg CO2e per kWh")
        if not forget_cobalt:
            v2 = tab.view("R2")
            tab.resolve("R2", [v2["excerpts"][0]["id"]], "16%")
        return "Battery A DPP summary: footprint 61.2 kg CO2e per kWh" + ("" if forget_cobalt else "; recycled cobalt 16%")


class TestRunningTab(unittest.TestCase):
    def test_listed_but_unread_files_become_candidates(self):
        tab = make_tab()
        tab.list_dir("passport/")
        tab.read_file("passport/battery_A.txt")
        self.assertEqual(tab.candidates, {"passport/battery_B.txt", "passport/supplier_audit.pdf.txt"})

    def test_view_ranks_matching_excerpt_and_candidates(self):
        tab = make_tab()
        rid = tab.add_requirement("supplier audit cobalt refinery")
        tab.list_dir("passport/")
        v = tab.view(rid)
        self.assertEqual(v["excerpts"], [])
        self.assertEqual(v["unopened_candidates"][0], "passport/supplier_audit.pdf.txt")

    def test_happy_path_finishes_with_receipt(self):
        tab = make_tab()
        deliverable = MockAgent().run(tab)
        r = tab.finish(deliverable)
        self.assertEqual(r["deliverable_sha256"], sha256(deliverable))
        ev = r["requirements"][0]["evidence"][0]
        self.assertEqual(ev["path"], "passport/battery_A.txt")
        self.assertEqual(ev["file_sha256"], sha256(FILES["passport/battery_A.txt"]))

    def test_finish_blocked_when_requirement_open(self):
        tab = make_tab()
        deliverable = MockAgent().run(tab, forget_cobalt=True)
        with self.assertRaises(FinishBlocked) as cm:
            tab.finish(deliverable)
        self.assertEqual([r.id for r in cm.exception.open_reqs], ["R2"])

    def test_finish_blocked_when_resolved_value_dropped_from_deliverable(self):
        tab = make_tab()
        MockAgent().run(tab)
        with self.assertRaises(FinishBlocked):
            tab.finish("Battery A summary with no numbers")

    def test_cannot_resolve_against_unread_evidence(self):
        tab = make_tab()
        rid = tab.add_requirement("anything")
        with self.assertRaises(KeyError):
            tab.resolve(rid, ["passport/battery_B.txt#0"], "x")
        with self.assertRaises(ValueError):
            tab.resolve(rid, [], "x")

    def test_set_aside_requires_reason_and_unblocks(self):
        tab = make_tab()
        rid = tab.add_requirement("state of health of battery C")
        with self.assertRaises(ValueError):
            tab.set_aside(rid, "  ")
        tab.set_aside(rid, "no battery C file in workspace")
        self.assertEqual(tab.finish_check(), [])
        self.assertEqual(tab.finish("report")["requirements"][0]["status"], "set_aside")

    def test_long_file_split_into_hashed_excerpts(self):
        files = {"big.txt": "x" * 1500}
        tab = RunningTab("t", reader=files.__getitem__, lister=lambda d: list(files), excerpt_chars=600)
        tab.read_file("big.txt")
        self.assertEqual(sorted(tab.excerpts), ["big.txt#0", "big.txt#1", "big.txt#2"])
        self.assertEqual(tab.excerpts["big.txt#2"].end, 1500)

    def test_event_log_and_json_roundtrip(self):
        tab = make_tab()
        MockAgent().run(tab)
        kinds = [e["kind"] for e in tab.events]
        self.assertEqual(kinds[:4], ["add_requirement", "add_requirement", "list", "read"])
        data = json.loads(tab.to_json())
        self.assertEqual(len(data["requirements"]), 2)


if __name__ == "__main__":
    unittest.main()
