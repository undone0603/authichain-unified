# AgentZ port of AI Adapt research build 2026-11-13 RecoveryGate (library only; nothing calls it yet).
# Source spec: project knowledge claude/builds/2026-11-13-recoverygate-ambiguous-outcomes.md
import unittest
from agentz.core.recovery_gate import RecoveryGate, Step, Capability, COMMITTED, FAILED, UNKNOWN


class Clock:
    def __init__(self): self.t = 0.0
    def __call__(self): return self.t


def mk(clock, **cap):
    return RecoveryGate([
        Step("send", "email_send", "k1", capability=Capability(**cap)),
        Step("log", "write_log", "k2", depends_on=["send"]),
    ], clock)


class T(unittest.TestCase):
    def test_all_ok_gives_goal_satisfied(self):
        c = Clock(); g = mk(c)
        g.record("send", "ok"); g.record("log", "ok")
        self.assertEqual(g.certificate().verdict, "GOAL_SATISFIED")

    def test_timeout_without_probe_or_idempotency_hands_off(self):
        c = Clock(); g = mk(c)
        g.record("send", "timeout")
        moves = {d.step_id: d for d in g.next_moves()}
        self.assertEqual(moves["send"].move, "HANDOFF")
        self.assertIn("double", moves["send"].reason)
        self.assertEqual(g.certificate().verdict, "HANDOFF")

    def test_probe_resolves_unknown_to_committed(self):
        c = Clock(); g = mk(c, probe=lambda k: COMMITTED)
        g.record("send", "timeout")
        moves = {d.step_id: d.move for d in g.next_moves()}
        self.assertEqual(moves["send"], "SKIP_COMMITTED")
        self.assertEqual(moves["log"], "EXECUTE")

    def test_probe_resolves_unknown_to_failed_then_retry(self):
        c = Clock(); g = mk(c, probe=lambda k: FAILED)
        g.record("send", "timeout")
        moves = {d.step_id: d.move for d in g.next_moves()}
        self.assertEqual(moves["send"], "RETRY")

    def test_probe_without_evidence_keeps_unknown(self):
        c = Clock(); g = mk(c, probe=lambda k: None)
        g.record("send", "timeout")
        self.assertEqual(g.adjudicate("send"), UNKNOWN)
        self.assertEqual(g.steps["send"].history[-1][2], "no_evidence")

    def test_idempotent_retry_admissible_within_ttl(self):
        c = Clock(); g = mk(c, idempotent_key_ttl=60)
        g.record("send", "timeout"); c.t = 30
        self.assertEqual({d.step_id: d.move for d in g.next_moves()}["send"], "RETRY")

    def test_idempotent_retry_blocked_after_ttl(self):
        c = Clock(); g = mk(c, idempotent_key_ttl=60)
        g.record("send", "timeout"); c.t = 61
        d = {d.step_id: d for d in g.next_moves()}["send"]
        self.assertEqual(d.move, "HANDOFF"); self.assertIn("expired", d.reason)

    def test_expired_authorization_blocks_execute(self):
        c = Clock()
        g = RecoveryGate([Step("pay", "charge", "k", auth_expires_at=10)], c)
        c.t = 11
        d = g.next_moves()[0]
        self.assertEqual(d.move, "HANDOFF"); self.assertIn("authorization", d.reason)

    def test_dependency_waits(self):
        c = Clock(); g = mk(c)
        g.record("send", "error")
        moves = {d.step_id: d.move for d in g.next_moves()}
        self.assertEqual(moves["log"], "WAIT_DEPS")

    def test_failed_step_gives_safe_stop_not_success(self):
        c = Clock(); g = mk(c)
        g.record("send", "error")
        cert = g.certificate()
        self.assertEqual(cert.verdict, "SAFE_STOP")
        self.assertEqual(cert.failed, ["send"]); self.assertEqual(cert.pending, ["log"])

    def test_history_is_append_only_record(self):
        c = Clock(); g = mk(c, probe=lambda k: COMMITTED)
        g.record("send", "timeout", "504"); c.t = 5; g.adjudicate("send")
        self.assertEqual([h[1] for h in g.steps["send"].history], ["timeout", "probe"])
        self.assertEqual(g.steps["send"].status, COMMITTED)


if __name__ == "__main__":
    unittest.main()
