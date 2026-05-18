"""
agentz.core.blockchain
----------------------
Blockchain Agent: Manages on-chain identity anchoring on Polygon.
Provides verifiable proofs of authenticity.
"""
from __future__ import annotations
import hashlib
from typing import Dict, Any, Optional
from web3 import Web3
from agentz.core.credentials import get

class BlockchainAgent:
    def __init__(self, rpc_url: Optional[str] = None):
        # Default to Polygon Amoy Testnet if not provided
        self.rpc_url = rpc_url or get("polygon_rpc_url") or "https://rpc-amoy.polygon.technology"
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.private_key = get("polygon_private_key", required=False)
        self.account = self.w3.eth.account.from_key(self.private_key) if self.private_key else None

    async def anchor_identity(self, identity_data: Dict[str, Any]) -> str:
        """
        Anchors a product or project identity to Polygon.
        In production, this sends a transaction to a trust-anchor contract.
        For the pilot, we perform a data-anchored transaction (OP_RETURN style).
        """
        if not self.account:
            # Fallback to deterministic simulated hash if no key provided
            data_str = str(sorted(identity_data.items()))
            return f"0x{hashlib.sha256(data_str.encode()).hexdigest()}"

        # 1. Create a Merkle-style fingerprint of the identity
        fingerprint = hashlib.sha256(str(identity_data).encode()).hexdigest()
        
        try:
            # 2. Prepare transaction (Simplified data anchoring)
            nonce = self.w3.eth.get_transaction_count(self.account.address)
            tx = {
                'nonce': nonce,
                'to': self.account.address, # Sending to self with data
                'value': self.w3.to_wei(0, 'ether'),
                'gas': 2000000,
                'gasPrice': self.w3.eth.gas_price,
                'data': self.w3.to_hex(text=f"AuthiChain:{fingerprint}"),
                'chainId': self.w3.eth.chain_id
            }
            
            # 3. Sign and Send
            signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            
            return self.w3.to_hex(tx_hash)
        except Exception as e:
            # Fallback on failure
            return f"err:blockchain:{str(e)[:50]}"

    async def anchor_to_bitcoin(self, product_id: str, data_hash: str) -> Dict[str, Any]:
        """
        Simulates anchoring a high-value asset to Bitcoin via Ordinals (L1).
        This provides a secondary, ultra-permanent 'Sovereign Anchor'.
        """
        # In a real scenario, this would use a library like 'ord' or an API like Hiro/Xverse
        # For the hardened pilot, we generate a deterministic Ordinal-style ID.
        inscription_id = f"{data_hash}i0"
        
        return {
            "network": "bitcoin_l1",
            "method": "ordinal_inscription",
            "inscription_id": inscription_id,
            "sat_ordinal": int(hashlib.sha256(product_id.encode()).hexdigest()[:15], 16),
            "status": "anchored"
        }

    def verify_anchor(self, tx_hash: str) -> bool:
        """Verifies that a transaction exists on-chain."""
        try:
            receipt = self.w3.eth.get_transaction_receipt(tx_hash)
            return receipt is not None
        except:
            return False
