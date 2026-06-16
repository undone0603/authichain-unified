"""
agentz.core.billing
------------------
Billing Agent: Manages usage tracking and Stripe Metered Billing integration.
"""
from __future__ import annotations
import httpx
import logging
from typing import Dict, Any, Optional
from abc import ABC, abstractmethod

logger = logging.getLogger("agentz.billing")

# ==========================================
# 1. Interfaces
# ==========================================
class BillingRepositoryInterface(ABC):
    @abstractmethod
    async def report_usage(self, customer_id: str, subscription_item_id: str, quantity: int = 1) -> Any:
        """Reports API usage for metered billing."""
        pass

    @abstractmethod
    async def log_api_call(self, api_key_id: str, endpoint: str) -> bool:
        """Logs an API call for audit and reconciliation."""
        pass


# ==========================================
# 2. Concrete Implementations
# ==========================================
class StripeBillingRepository(BillingRepositoryInterface):
    def __init__(self, stripe_client: Any, supabase_client: Optional[Any] = None):
        """
        Injects the initialized Stripe and Supabase clients.
        """
        self.stripe = stripe_client
        self.supabase = supabase_client

    async def report_usage(self, customer_id: str, subscription_item_id: str, quantity: int = 1) -> Any:
        try:
            # We use Stripe's usage record API
            # Ref: https://stripe.com/docs/api/usage_records/create
            usage = self.stripe.SubscriptionItem.create_usage_record(
                subscription_item_id,
                quantity=quantity,
                timestamp="now",
                action="increment"
            )
            logger.info(f"Reported {quantity} API calls for customer {customer_id}")
            return usage
        except Exception as e:
            logger.error(f"Stripe Usage Report Failed: {e}")
            return None

    async def log_api_call(self, api_key_id: str, endpoint: str) -> bool:
        payload = {
            "api_key_id": api_key_id,
            "endpoint": endpoint,
            "timestamp": "now()"
        }
        if self.supabase:
            # In production: 
            # await self.supabase.table("api_usage").insert(payload).execute()
            pass
        return True


class MockBillingRepository(BillingRepositoryInterface):
    """Safely mocks billing and database logic for --mode dry-run."""
    
    async def report_usage(self, customer_id: str, subscription_item_id: str, quantity: int = 1) -> Any:
        logger.info(f"[MOCK] Reported {quantity} API calls for customer {customer_id}")
        return {"id": "mock_usage_record_123", "quantity": quantity, "customer": customer_id}

    async def log_api_call(self, api_key_id: str, endpoint: str) -> bool:
        logger.info(f"[MOCK] Logged API call for key {api_key_id} to endpoint {endpoint}")
        return True


# ==========================================
# 3. The Autonomous Agent
# ==========================================
class BillingAgent:
    def __init__(self, billing_repo: BillingRepositoryInterface):
        """
        The agent relies entirely on the repository interface.
        Global secret fetches (e.g., get("stripe_secret")) are eliminated.
        """
        self.billing_repo = billing_repo

    async def report_usage(self, customer_id: str, subscription_item_id: str, quantity: int = 1):
        """
        Delegates API usage reporting to the injected repository.
        """
        return await self.billing_repo.report_usage(
            customer_id=customer_id, 
            subscription_item_id=subscription_item_id, 
            quantity=quantity
        )

    async def log_api_call(self, api_key_id: str, endpoint: str):
        """
        Delegates audit logging to the injected database client inside the repository.
        """
        return await self.billing_repo.log_api_call(
            api_key_id=api_key_id, 
            endpoint=endpoint
        )
