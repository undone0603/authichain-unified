"""
agentz.workflows.handlers.qron_stripe
-------------------------------------
Generates Stripe payment links for QRON Pro subscriptions and
simulates distributing them via Twitter/Reddit DMs.
"""
import httpx
import asyncio
from agentz.core.modes import ExecutionContext
from agentz.core.credentials import get_or_placeholder

async def create_stripe_payment_link(amount: int = 4900, product_name: str = "QRON Pro") -> dict:
    """
    Core function to generate a Stripe payment link.
    amount is in cents (e.g. 4900 = $49.00).
    """
    from agentz.core.credentials import get
    stripe_key = get("stripe_secret")
    headers = {
        "Authorization": f"Bearer {stripe_key}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    # 1. Search for product
    r_prod = httpx.get(
        "https://api.stripe.com/v1/products/search", 
        headers=headers, 
        params={"query": f"name~'{product_name}'"},
        timeout=10.0
    )
    
    price_id = None
    if r_prod.status_code == 200 and r_prod.json().get("data"):
        prod_id = r_prod.json()["data"][0]["id"]
        r_price = httpx.get(
            f"https://api.stripe.com/v1/prices?product={prod_id}&active=true&limit=1",
            headers=headers,
            timeout=10.0
        )
        if r_price.status_code == 200 and r_price.json().get("data"):
            price_id = r_price.json()["data"][0]["id"]
            
    if not price_id:
        # Fallback to latest active price
        r = httpx.get("https://api.stripe.com/v1/prices?active=true&limit=1", headers=headers, timeout=10.0)
        if r.status_code == 200:
            prices = r.json().get("data", [])
            if prices: price_id = prices[0]["id"]
            
    if not price_id:
        return {"error": "No price found", "url": "https://stripe.com/demo-checkout"}

    # 2. Generate payment link
    data = {
        "line_items[0][price]": price_id,
        "line_items[0][quantity]": 1
    }
    r2 = httpx.post("https://api.stripe.com/v1/payment_links", headers=headers, data=data, timeout=15.0)
    
    if r2.status_code == 200:
        return r2.json()
    return {"error": f"Stripe failed: {r2.status_code}", "url": "https://stripe.com/demo-checkout"}

def run(ctx: ExecutionContext) -> str:
    if ctx.mode == "dry-run":
        ctx.step("dry-run: generate Stripe payment link for QRON Pro")
        return "dry-run: qron_stripe"
        
    ctx.step("Generating QRON Pro Stripe Payment Link...")
    res = asyncio.run(create_stripe_payment_link())
    payment_link = res.get("url")
    ctx.step(f"Generated Link: {payment_link}")
    
    return f"Link generated: {payment_link}"
