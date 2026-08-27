"""
adversarial_trust_enforcement.py
--------------------------------
Autonomous workflow handler: Triggers 'Revocation Proofs' on-chain for 
products flagged as severe counterfeits.
"""
from agentz.core.blockchain import BlockchainAgent
from agentz.core.credentials import get_supabase_client
from agentz.core.modes import ExecutionContext

def run(ctx: ExecutionContext):
    ctx.step("Scanning for high-severity counterfeit flags...")
    supabase = get_supabase_client()
    
    # Query for products flagged by Trust Agent
    flagged_products = supabase.table("products")\
        .select("id, qron_id, metadata")\
        .eq("metadata->>security_flag", "geo_anomaly")\
        .execute().data
    
    if not flagged_products:
        return "No severe anomalies detected."
        
    blockchain = BlockchainAgent()
    count = 0
    
    for p in flagged_products:
        ctx.step(f"Revoking identity for product: {p['id']}")
        
        # 1. On-chain Revocation Proof
        revocation_data = {"qron_id": p["qron_id"], "reason": "geo_anomaly_detected", "status": "REVOKED"}
        tx_hash = blockchain.anchor_identity(revocation_data)
        
        # 2. Update Supabase
        supabase.table("products").update({
            "metadata": {**p["metadata"], "status": "REVOKED", "revocation_tx": tx_hash}
        }).eq("id", p["id"]).execute()
        
        count += 1
        
    return f"Enforcement complete. {count} identities revoked on-chain."
