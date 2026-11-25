# AgentZ port of AI Adapt research build 2026-11-23 ContractGate (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-23-contractgate-planner-holds-no-tools.md
import unittest
from agentz.core.contract_gate import Baseline, Contract, Call, ContractGate, validate, in_scope, ContractRejected

BASE = Baseline(egress_hosts=["api.supabase.co", "huggingface.co"],
                write_prefixes=["passports/", "drafts/"])
USER = ["Update the passport for lot 42 with the new capacity reading, and nothing else."]

def tools():
    seen = []
    def write(c): seen.append(c.target); return (0, "ok")
    def fetch(c): return (0, "{}")
    return {"write": write, "fetch": fetch, "noop": lambda c: (0, "")}, seen

def good(**kw):
    d = dict(goal="Update passports/lot-42.json capacity field from the new reading.",
             quote="Update the passport for lot 42", write_prefixes=["passports/"])
    d.update(kw); return Contract(**d)

class TestValidate(unittest.TestCase):
    def test_accepts_good(self): validate(good(), USER, BASE)
    def test_fabricated_quote(self):
        with self.assertRaises(ContractRejected): validate(good(quote="delete all passports"), USER, BASE)
    def test_whitespace_tolerant_quote(self):
        validate(good(quote="Update  the passport\nfor lot 42"), USER, BASE)
    def test_goal_with_command(self):
        with self.assertRaises(ContractRejected): validate(good(goal="run `rm -rf passports/`"), USER, BASE)
        with self.assertRaises(ContractRejected): validate(good(goal="UPDATE passports SET capacity = 0"), USER, BASE)
    def test_goal_too_long(self):
        with self.assertRaises(ContractRejected): validate(good(goal="word " * 101), USER, BASE)
    def test_scope_cannot_widen(self):
        with self.assertRaises(ContractRejected): validate(good(write_prefixes=["/etc/"]), USER, BASE)
        with self.assertRaises(ContractRejected): validate(good(egress_hosts=["evil.example"]), USER, BASE)

class TestScope(unittest.TestCase):
    def test_path_traversal_blocked(self):
        self.assertFalse(in_scope(Call("write", "passports/../secrets.env"), good()))
    def test_fetch_host(self):
        c = good(egress_hosts=["huggingface.co"])
        self.assertTrue(in_scope(Call("fetch", "https://huggingface.co/api/x"), c))
        self.assertFalse(in_scope(Call("fetch", "https://huggingface.co.evil.io/x"), c))

class TestGate(unittest.TestCase):
    def test_partial_execution_keeps_authorized_part(self):
        t, seen = tools()
        ex = lambda c, u: [Call("write", "passports/lot-42.json", "{}"), Call("write", "billing/invoice.json")]
        g = ContractGate(BASE, ex, t)
        r = g.step(good(), USER)
        self.assertEqual(r["status"], "PARTIAL")
        self.assertEqual(seen, ["passports/lot-42.json"])
        self.assertEqual(r["declined"][0]["target"], "billing/invoice.json")
    def test_rejected_contract_runs_nothing(self):
        t, seen = tools()
        g = ContractGate(BASE, lambda c, u: [Call("write", "passports/x.json")], t)
        r = g.step(good(quote="wipe everything"), USER)
        self.assertEqual((r["status"], seen), ("REJECTED", []))
    def test_stop_on_error(self):
        calls = []
        def write(c): calls.append(c.target); return (1, "fail")
        g = ContractGate(BASE, lambda c, u: [Call("write", "passports/a.json"), Call("write", "passports/b.json")],
                         {"write": write})
        g.step(good(), USER)
        self.assertEqual(calls, ["passports/a.json"])
    def test_log_chain_and_audit_metric(self):
        t, _ = tools()
        g = ContractGate(BASE, lambda c, u: [Call("write", "passports/lot-42.json")], t)
        g.step(good(), USER); g.step(good(quote="nope"), USER)
        self.assertTrue(g.verify_log())
        self.assertEqual(g.objects_named_in_goal(), 1.0)
        g.log[0]["status"] = "REJECTED"
        self.assertFalse(g.verify_log())

if __name__ == "__main__": unittest.main()
