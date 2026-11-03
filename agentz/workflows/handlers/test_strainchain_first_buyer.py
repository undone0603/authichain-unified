import unittest
from types import SimpleNamespace
from .strainchain_first_buyer import run

class FirstBuyerWorkflowTest(unittest.TestCase):
    def test_empty_context_stays_unverified(self):
        result = run(SimpleNamespace(parameters={}))
        self.assertIn('PAYMENT_NOT_VERIFIED', result)
        self.assertIn('customer_sale_verified=false', result)
    def test_untrusted_provider_shape_does_not_create_sale(self):
        result = run(SimpleNamespace(parameters={'evidence': {'session': {'status': 'complete', 'payment_status': 'paid'}}}))
        self.assertIn('PAYMENT_NOT_VERIFIED', result)
        self.assertIn('automatic_issuance_allowed=false', result)
    def test_invalid_input_refused(self):
        with self.assertRaises(ValueError): run(SimpleNamespace(parameters={'evidence':['bad']}))

if __name__ == '__main__':
    unittest.main()
