"""No browser_use installation required: stub only its ActionResult interface."""
from __future__ import annotations
import sys
import types
import unittest
from unittest.mock import patch
from agentz.core.modes import Mode
from agentz.core.browser_guard import attach_interceptor


class FakeResult:
    def __init__(self, extracted_content=None, error=None):
        self.extracted_content = extracted_content
        self.error = error


class Registry:
    def wrap_all(self, factory):
        self.factory = factory


class Context:
    def __init__(self, mode, approve=None):
        self.mode, self.approve = mode, approve
        self.calls = []

    def step(self, description, action=None):
        self.calls.append(description)
        return action() if self.approve and action else None


class GuardTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.module = patch.dict(sys.modules, {"browser_use": types.SimpleNamespace(ActionResult=FakeResult)})
        self.module.start()

    async def asyncTearDown(self):
        self.module.stop()

    async def test_confirm_decline_does_not_call_action(self):
        c, r = Context(Mode.CONFIRM, approve=False), Registry()
        attach_interceptor(types.SimpleNamespace(registry=r), c)
        invoked = []
        async def click(token="sensitive"):
            invoked.append(token)
        out = await r.factory(click)(token="private-secret")
        self.assertEqual(invoked, [])
        self.assertIn("not authorized", out.error)
        self.assertNotIn("private-secret", str(c.calls))

    async def test_dry_run_does_not_call_action(self):
        c, r = Context(Mode.DRY_RUN), Registry()
        attach_interceptor(types.SimpleNamespace(registry=r), c)
        invoked = []
        async def fill():
            invoked.append("mutated")
        out = await r.factory(fill)()
        self.assertEqual(invoked, [])
        self.assertIn("DRY RUN", out.extracted_content)

    async def test_confirm_accept_is_single_action(self):
        c, r = Context(Mode.CONFIRM, approve=True), Registry()
        attach_interceptor(types.SimpleNamespace(registry=r), c)
        invoked = []
        async def press():
            invoked.append("pressed")
        await r.factory(press)()
        self.assertEqual(invoked, ["pressed"])
        self.assertEqual(c.calls, ["Browser action: press"])

    async def test_unattended_auto_and_missing_interceptor_refuse(self):
        with self.assertRaises(RuntimeError):
            attach_interceptor(types.SimpleNamespace(registry=Registry()), Context(Mode.AUTO))
        with self.assertRaises(RuntimeError):
            attach_interceptor(types.SimpleNamespace(registry=object()), Context(Mode.CONFIRM))


if __name__ == "__main__":
    unittest.main()
