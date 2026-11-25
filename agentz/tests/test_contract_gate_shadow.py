"""ContractGate shadow mode and the ChoiceCall executor pairing.

Shadow mode is the rollout Zac approved on 2026-11-23: contracts are logged and
judged against the calls the current path already made, and nothing is run,
blocked or raised.
"""
import json
import unittest

from agentz.core.choice_call import ChoiceCaller, Param, Tool, NOT_STATED, DECLINE
from agentz.core.contract_gate import (
    Call, Contract, ContractGate, choicecall_executor, write_shadow_log,
)
from agentz.tests.test_contract_gate import BASE, USER, good


def never_runs(*_a, **_k):
    raise AssertionError("shadow mode must not execute or plan anything")


class TestShadow(unittest.TestCase):
    def gate(self):
        return ContractGate(BASE, never_runs, {"write": never_runs, "fetch": never_runs})

    def test_in_scope_calls_are_logged_and_nothing_runs(self):
        g = self.gate()
        r = g.shadow(good(), USER, [Call("write", "passports/lot-42.json")])
        self.assertEqual(r["status"], "SHADOW_IN_SCOPE")
        self.assertEqual([x["target"] for x in r["ran"]], ["passports/lot-42.json"])
        self.assertEqual(r["declined"], [])

    def test_over_reach_is_recorded_not_blocked(self):
        g = self.gate()
        r = g.shadow(good(), USER, [Call("write", "passports/lot-42.json"), Call("write", "drafts/other.md")])
        self.assertEqual(r["status"], "SHADOW_PARTIAL")
        self.assertEqual([x["target"] for x in r["declined"]], ["drafts/other.md"])

    def test_all_out_of_scope(self):
        r = self.gate().shadow(good(), USER, [Call("fetch", "https://evil.example/x")])
        self.assertEqual(r["status"], "SHADOW_OUT_OF_SCOPE")

    def test_rejected_contract_and_missing_contract(self):
        g = self.gate()
        r = g.shadow(good(quote="delete all passports"), USER, [Call("write", "passports/a.json")])
        self.assertEqual(r["status"], "SHADOW_REJECTED")
        self.assertIn("verbatim", r["reason"])
        r = g.shadow(None, USER, [Call("write", "passports/a.json")])
        self.assertEqual(r["status"], "SHADOW_NO_CONTRACT")
        self.assertTrue(g.verify_log())

    def test_shadow_log_sink_round_trips(self):
        import tempfile, os
        g = self.gate()
        g.shadow(good(), USER, [Call("write", "passports/lot-42.json")])
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "contracts.jsonl")
            write_shadow_log(g.log, path)
            rows = [json.loads(line) for line in open(path, encoding="utf-8")]
        self.assertEqual(rows, g.log)


class TestSealedBeforeDispatch(unittest.TestCase):
    def test_contract_is_logged_before_the_executor_runs(self):
        seen_log_len = []
        g = None

        def executor(c, u):
            seen_log_len.append(len(g.log))
            raise RuntimeError("executor crashed")

        g = ContractGate(BASE, executor, {})
        with self.assertRaises(RuntimeError):
            g.step(good(), USER)
        self.assertEqual(seen_log_len, [1])
        self.assertEqual(g.log[0]["status"], "SUBMITTED")
        self.assertTrue(g.verify_log())


BID_TOOLS = [Tool("write_passport", "write passport for lot", [
    Param("lot", "enum", enum=["41", "42", "43"]),
    Param("field", "enum", enum=["capacity", "chemistry"]),
])]


def first_match(q):
    """Deterministic decision stand-in: pick the first option stated in the request."""
    req = q.prompt.split("\n")[0].lower()
    if q.key == "tool":
        return q.options.index("write_passport") if "passport" in req else q.options.index(DECLINE)
    for i, o in enumerate(q.options):
        if o not in (NOT_STATED,) and f" {o.lower()}" in f" {req}":
            return i
    return q.options.index(NOT_STATED)


class TestChoiceCallExecutor(unittest.TestCase):
    def test_choicecall_writes_the_call_from_the_users_words(self):
        caller = ChoiceCaller(BID_TOOLS, first_match)
        to_call = lambda r: Call("write", f"passports/lot-{r.args['lot']}.json")
        written = []
        tools = {"write": lambda c: (written.append(c.target), (0, "ok"))[1]}
        g = ContractGate(BASE, choicecall_executor(caller, to_call), tools)
        r = g.step(good(quote="Update the passport for lot 42 with the new capacity reading"), USER)
        self.assertEqual(r["status"], "EXECUTED")
        self.assertEqual(written, ["passports/lot-42.json"])
        self.assertTrue(caller.verify_ledger())

    def test_choicecall_decline_means_no_call(self):
        caller = ChoiceCaller(BID_TOOLS, lambda q: q.options.index(DECLINE) if q.key == "tool" else 0)
        g = ContractGate(BASE, choicecall_executor(caller, never_runs), {"write": never_runs})
        r = g.step(good(), USER)
        self.assertEqual(r["status"], "DECLINED")


if __name__ == "__main__":
    unittest.main()
