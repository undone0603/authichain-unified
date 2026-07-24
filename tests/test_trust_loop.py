import unittest
from unittest.mock import MagicMock, patch
from agentz.core.blockchain import BlockchainAgent

class TestBlockchainAgent(unittest.TestCase):
    def setUp(self):
        # Mock credentials
        def side_effect(key, required=False):
            if key == "polygon_private_key":
                return '0' * 64
            return 'mock_value'
            
        with patch('agentz.core.blockchain.get', side_effect=side_effect):
            self.agent = BlockchainAgent(rpc_url='http://mock-rpc')
            # Mock account and w3
            self.agent.account = MagicMock()
            self.agent.account.address = '0x123'
            self.agent.w3 = MagicMock()

    def test_claim_counterfeit_bounty_calls_contract(self):
        # Mock contract and transaction building
        mock_contract = MagicMock()
        mock_functions = MagicMock()
        mock_contract.functions.claimBounty = mock_functions
        self.agent.w3.eth.contract.return_value = mock_contract
        
        # Mock transaction building and signing
        self.agent.w3.eth.get_transaction_count.return_value = 1
        self.agent.w3.eth.gas_price = 1000
        self.agent.w3.eth.chain_id = 137
        
        # Call the method
        with patch('agentz.core.blockchain.get', return_value='0xContract'):
            result = self.agent.claim_counterfeit_bounty('CERT123', '0xClaimant')
            
        # Assertions
        mock_functions.assert_called_with('CERT123', '0xClaimant')
        self.assertTrue(result.startswith('0x'))

    @patch('agentz.core.trust.BlockchainAgent')
    def test_monitor_scans_triggers_bounty_claim(self, MockBlockchainAgent):
        # Mock Supabase
        mock_supabase = MagicMock()
        mock_product = {
            'qron_id': 123,
            'metadata': {'certificate_number': 'CERT-LOW-TRUST', 'target_market': 'US'},
            'authenticity_score': 25.0 # Should trigger
        }
        
        # Setup mock supabase response
        mock_product_response = MagicMock()
        mock_product_response.data = mock_product
        mock_supabase.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value = mock_product_response
        
        mock_scans_response = MagicMock()
        mock_scans_response.data = []
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = mock_scans_response
        
        # Setup mock blockchain agent
        mock_bc_instance = MockBlockchainAgent.return_value
        
        # Import and run function under test
        from agentz.core.trust import monitor_scans
        import asyncio
        
        asyncio.run(monitor_scans(mock_supabase, 'prod-123'))
        
        # Verify bounty claim was triggered
        mock_bc_instance.claim_counterfeit_bounty.assert_called_with('CERT-LOW-TRUST', '0x0000000000000000000000000000000000000000')

if __name__ == '__main__':
    unittest.main()
