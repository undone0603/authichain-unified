# AgentZ port of AI Adapt research build 2026-10-22 LoopGuard (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-10-22-loopguard-deloop.md
import unittest
from agentz.core.loop_guard import (call_fingerprint, Step, mark_loops, extract_dpo_pairs,
                       loop_metrics, LoopGuard, guarded)


class TestFingerprint(unittest.TestCase):
    def test_arg_order_irrelevant(self):
        self.assertEqual(call_fingerprint("search", {"q": "x", "n": 5}),
                         call_fingerprint("search", {"n": 5, "q": "x"}))

    def test_different_args_differ(self):
        self.assertNotEqual(call_fingerprint("search", {"q": "x"}),
                            call_fingerprint("search", {"q": "y"}))


class TestMarkLoops(unittest.TestCase):
    def test_same_call_same_obs_is_loop(self):
        s = mark_loops([Step("ls", {"p": "/"}, "a b"), Step("ls", {"p": "/"}, "a b")])
        self.assertEqual([x.is_loop for x in s], [False, True])

    def test_same_call_new_obs_not_loop(self):
        # state changed between calls -> new information -> not a loop
        s = mark_loops([Step("ls", {"p": "/"}, "a"), Step("ls", {"p": "/"}, "a b")])
        self.assertEqual([x.is_loop for x in s], [False, False])


class TestDPOPairs(unittest.TestCase):
    def test_pair_uses_first_later_non_loop(self):
        r = [Step("read", {"f": "a"}, "1"),
             Step("read", {"f": "a"}, "1"),      # loop
             Step("read", {"f": "a"}, "1"),      # loop
             Step("write", {"f": "b"}, "ok")]    # first later non-loop
        pairs = extract_dpo_pairs(r)
        self.assertEqual(len(pairs), 2)
        for p in pairs:
            self.assertEqual(p["rejected"], {"tool": "read", "args": {"f": "a"}})
            self.assertEqual(p["chosen"], {"tool": "write", "args": {"f": "b"}})
        self.assertEqual(len(pairs[0]["prompt"]), 1)

    def test_trailing_loop_yields_no_pair(self):
        r = [Step("read", {"f": "a"}, "1"), Step("read", {"f": "a"}, "1")]
        self.assertEqual(extract_dpo_pairs(r), [])


class TestMetrics(unittest.TestCase):
    def test_metrics(self):
        clean = [Step("a", {}, "1"), Step("b", {}, "2")]
        loopy = [Step("a", {}, "1"), Step("a", {}, "1"), Step("b", {}, "2"), Step("c", {}, "3")]
        m = loop_metrics([clean, loopy])
        self.assertEqual(m["share_with_loops"], 0.5)
        self.assertEqual(m["avg_steps"], 3.0)
        self.assertAlmostEqual(m["loop_step_share"], 1 / 6)


class TestGuard(unittest.TestCase):
    def test_guard_flags_loop_and_nudges(self):
        g = LoopGuard()
        self.assertEqual(g.after("ls", {"p": "/"}, "x")["verdict"], "ok")
        self.assertEqual(g.check("ls", {"p": "/"}), {"verdict": "execute", "repeat_call": True})
        post = g.after("ls", {"p": "/"}, "x")
        self.assertEqual(post["verdict"], "loop")
        self.assertIsNotNone(post["nudge"])

    def test_idempotent_tool_served_from_cache(self):
        calls = []
        def fetch(url):
            calls.append(url)
            return "page"
        g = LoopGuard(idempotent_tools={"fetch"})
        t = guarded(g, "fetch", fetch)
        t(url="u"); out = t(url="u")
        self.assertEqual(len(calls), 1)            # second call never hit the tool
        self.assertEqual(out["observation"], "page")
        self.assertEqual(g.loops, 1)

    def test_non_idempotent_tool_still_executes(self):
        calls = []
        def send(to):
            calls.append(to)
            return "sent"
        g = LoopGuard()  # send is not idempotent -> never short-circuited
        t = guarded(g, "send", send)
        t(to="a"); out = t(to="a")
        self.assertEqual(len(calls), 2)
        self.assertIsNotNone(out["loopguard"])

    def test_halt_after_budget(self):
        g = LoopGuard(max_loops=2)
        t = guarded(g, "ls", lambda p: "same")
        t(p="/"); t(p="/")
        with self.assertRaises(RuntimeError):
            t(p="/")
        with self.assertRaises(RuntimeError):   # stays halted
            t(p="/other")

    def test_mocked_llm_agent_rollout(self):
        # mocked LLM policy that loops twice, then recovers
        script = iter([("search", {"q": "battery"}), ("search", {"q": "battery"}),
                       ("search", {"q": "battery"}), ("open", {"id": 1})])
        tools = {"search": lambda q: ["doc1"], "open": lambda id: "content"}
        g = LoopGuard(max_loops=5)
        for name, args in script:
            guarded(g, name, tools[name])(**args)
        self.assertEqual(g.loops, 2)
        pairs = extract_dpo_pairs(g.history)
        self.assertEqual(len(pairs), 2)
        self.assertEqual(pairs[0]["chosen"]["tool"], "open")


if __name__ == "__main__":
    unittest.main()
