import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from .negotiate_draft import run


class NegotiateDraftTest(unittest.TestCase):
    def test_no_brief_is_safe(self):
        self.assertIn("INPUT_REQUIRED",run(SimpleNamespace(parameters={})))

    def test_oversized_brief_is_refused(self):
        result=run(SimpleNamespace(parameters={"negotiation":{"objective":"x"*20000}}))
        self.assertIn("INVALID_INPUT",result)

    def test_safe_proposal_summary_never_runs_external_action(self):
        report={
            "decision":"NO_AGREEMENT_OR_AUTHORIZATION",
            "sideEffectsPerformed":0,
            "allowedActions":{"purchase":False},
            "batna":{"declared":False},
            "proposals":[{"id":"opening"}],
        }
        output=SimpleNamespace(returncode=0,stdout=json.dumps(report))
        with patch("pathlib.Path.is_file",return_value=True),patch(
            "agentz.workflows.handlers.negotiate_draft.subprocess.run",return_value=output
        ) as command:
            result=run(SimpleNamespace(parameters={"negotiation":{"objective":"a","issues":[]}}))
        self.assertIn("PROPOSALS_ONLY",result)
        self.assertIn("no purchase or payment",result)
        self.assertEqual(command.call_args.kwargs["timeout"],10)

    def test_unexpected_approval_is_refused(self):
        output=SimpleNamespace(returncode=0,stdout=json.dumps({
            "decision":"ORDER_APPROVED","sideEffectsPerformed":1,
            "allowedActions":{"purchase":True}
        }))
        with patch("pathlib.Path.is_file",return_value=True),patch(
            "agentz.workflows.handlers.negotiate_draft.subprocess.run",return_value=output
        ):
            self.assertIn("SAFETY_HOLD",run(SimpleNamespace(parameters={"negotiation":{"objective":"x"}})))


if __name__=="__main__":
    unittest.main()
