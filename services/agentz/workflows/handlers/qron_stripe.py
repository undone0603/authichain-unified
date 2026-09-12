"""
agentz.workflows.handlers.qron_stripe
-------------------------------------
Generates Stripe payment links for QRON Pro (or a caller-supplied amount)
and surfaces the URL for warm-lead distribution.

`amount` is honored: we select an existing Price whose unit_amount matches
the requested cents, or create a one-off Price on the product when none match.
"""
from __future__ import annotations

import asyncio

import httpx

from agentz.core.modes import ExecutionContext


async def create_stripe_payment_link(
    amount: int = 4900, product_name: str = "QRON Pro"
) -> dict:
    """
    Generate a Stripe payment link.

    amount is in cents (e.g. 4900 = $49.00) and MUST match the Price used —
    previously this argument was ignored and the first active price won.
    """
    from agentz.core.credentials import get

    stripe_key = get("stripe_secret")
    headers = {
        "Authorization": f"Bearer {stripe_key}",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    # 1. Find (or create) the product
    prod_id = None
    r_prod = httpx.get(
        "https://api.stripe.com/v1/products/search",
        headers=headers,
        params={"query": f"name:'{product_name}'"},
        timeout=10.0,
    )
    if r_prod.status_code == 200 and r_prod.json().get("data"):
        prod_id = r_prod.json()["data"][0]["id"]
    else:
        # Fuzzy fallback then create
        r_prod2 = httpx.get(
            "https://api.stripe.com/v1/products/search",
            headers=headers,
            params={"query": f"name~'{product_name}'"},
            timeout=10.0,
        )
        if r_prod2.status_code == 200 and r_prod2.json().get("data"):
            prod_id = r_prod2.json()["data"][0]["id"]
        else:
            r_create = httpx.post(
                "https://api.stripe.com/v1/products",
                headers=headers,
                data={"name": product_name},
                timeout=15.0,
            )
            if r_create.status_code == 200:
                prod_id = r_create.json()["id"]

    if not prod_id:
        return {"error": "No product found/created", "url": "https://stripe.com/demo-checkout"}

    # 2. Find a Price on that product whose unit_amount matches `amount`
    price_id = None
    r_price = httpx.get(
        f"https://api.stripe.com/v1/prices?product={prod_id}&active=true&limit=100",
        headers=headers,
        timeout=10.0,
    )
    if r_price.status_code == 200:
        for price in r_price.json().get("data", []):
            if (
                price.get("unit_amount") == amount
                and price.get("currency") == "usd"
                and price.get("type") == "one_time"
            ):
                price_id = price["id"]
                break
            # Also accept matching recurring amounts if that's all that exists
            if price_id is None and price.get("unit_amount") == amount and price.get("currency") == "usd":
                price_id = price["id"]

    # 3. Create a one-off Price when none match the requested cents
    if not price_id:
        r_new = httpx.post(
            "https://api.stripe.com/v1/prices",
            headers=headers,
            data={
                "product": prod_id,
                "unit_amount": str(amount),
                "currency": "usd",
            },
            timeout=15.0,
        )
        if r_new.status_code == 200:
            price_id = r_new.json()["id"]
        else:
            return {
                "error": f"Price create failed: {r_new.status_code} {r_new.text[:160]}",
                "url": "https://stripe.com/demo-checkout",
            }

    # 4. Generate payment link against the amount-matched price
    data = {
        "line_items[0][price]": price_id,
        "line_items[0][quantity]": 1,
    }
    r2 = httpx.post(
        "https://api.stripe.com/v1/payment_links", headers=headers, data=data, timeout=15.0
    )

    if r2.status_code == 200:
        payload = r2.json()
        payload["_matched_amount_cents"] = amount
        payload["_price_id"] = price_id
        return payload
    return {"error": f"Stripe failed: {r2.status_code}", "url": "https://stripe.com/demo-checkout"}


def run(ctx: ExecutionContext) -> str:
    amount = 4900
    product_name = "QRON Pro"
    if ctx.mode == "dry-run" or str(ctx.mode) == "dry-run":
        ctx.step(
            f"dry-run: generate Stripe payment link for {product_name} at {amount} cents"
        )
        return "dry-run: qron_stripe"

    ctx.step(f"Generating {product_name} Stripe Payment Link at {amount} cents...")
    res = asyncio.run(create_stripe_payment_link(amount=amount, product_name=product_name))
    payment_link = res.get("url")
    ctx.step(f"Generated Link: {payment_link} (price={res.get('_price_id')})")

    return f"Link generated: {payment_link}"
