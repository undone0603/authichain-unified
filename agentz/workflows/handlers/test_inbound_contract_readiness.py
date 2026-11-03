import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from .inbound_contract_readiness import run

class ContractReadinessTest(unittest.TestCase):
    def test_no_contract_means_no_agreement(self):
        self.assertIn("HOLD",run(SimpleNamespace(parameters={})))
    def test_unsafe_output_is_refused(self):
        r={"accepted":True,"automaticAcceptanceAuthorized":True,
           "automaticSpendAuthorized":False,"noOutboundFunds":True}
        fake=SimpleNamespace(returncode=0,stdout=json.dumps(r))
        with patch("pathlib.Path.is_file",return_value=True),patch(
            "agentz.workflows.handlers.inbound_contract_readiness.subprocess.run",
            return_value=fake):
            self.assertIn("unsafe",run(SimpleNamespace(parameters={"inboundContract":{"contract":{"id":"something"}}})))
    def test_no_spending_after_preflight(self):
        r={"accepted":False,"automaticAcceptanceAuthorized":False,
           "automaticSpendAuthorized":False,"noOutboundFunds":True,
           "status":"BLOCKED","missing":["agentz_reproducible_fulfillment"]}
        fake=SimpleNamespace(returncode=0,stdout=json.dumps(r))
        with patch("pathlib.Path.is_file",return_value=True),patch(
            "agentz.workflows.handlers.inbound_contract_readiness.subprocess.run",
            return_value=fake) as cmd:
            result=run(SimpleNamespace(parameters={"inboundContract":{"contract":{"id":"something"}}}))
        self.assertIn("no signature, no agreement",result)
        self.assertEqual(cmd.call_args.kwargs["timeout"],10)
