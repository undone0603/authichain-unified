"""
agentz.workflows.revenue_pipeline_sync
--------------------------------------
Executes the autonomous revenue synchronization, relying strictly 
on injected dependencies for billing and database operations.
"""
from agentz.core.modes import ExecutionContext
from agentz.core.billing import BillingAgent

def run(ctx: ExecutionContext, deps: dict) -> str:
    ctx.step("Initializing BillingAgent with injected repository...")
    
    # 1. Safely extract the injected repository
    billing_repo = deps.get("billing_repo")
    if not billing_repo:
        raise ValueError("Critical Dependency Missing: billing_repo was not injected.")

    # 2. Instantiate the pure agent
    agent = BillingAgent(billing_repo=billing_repo)

    # 3. Execute business logic
    ctx.step("Running autonomous usage report...")
    customer_id = "cus_example123"
    subscription_item_id = "si_example456"
    
    # Using the async methods we defined earlier (ensure you await if this run function becomes async, 
    # or use asyncio.run() if the handler remains synchronous)
    import asyncio
    
    async def process_billing():
        usage_result = await agent.report_usage(
            customer_id=customer_id, 
            subscription_item_id=subscription_item_id, 
            quantity=150
        )
        await agent.log_api_call("key_test", "/v1/inference")
        return usage_result

    # Execute the async agent logic
    result = asyncio.run(process_billing())

    ctx.step(f"Billing operation complete. Result: {result}")
    
    return f"Successfully processed revenue sync for {customer_id}."
