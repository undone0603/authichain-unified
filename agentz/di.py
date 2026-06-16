"""
agentz.di
-----------
Dependency Injection container for the AgentZ control plane.
"""
import stripe
from typing import Dict, Any

from agentz.core.billing import StripeBillingRepository, MockBillingRepository
from agentz.core.credentials import get

def init(mode_str: str) -> Dict[str, Any]:
    """
    Builds and returns the dependency graph for injected agents 
    based on the execution mode.
    """
    is_dry_run = mode_str == "dry-run"
    
    if is_dry_run:
        return {
            "billing_repo": MockBillingRepository()
        }
        
    # 1. Live Initialization
    stripe.api_key = get("stripe_secret", required=False)
    
    # 2. Wire up the concrete implementations
    return {
        "billing_repo": StripeBillingRepository(stripe_client=stripe)
    }
