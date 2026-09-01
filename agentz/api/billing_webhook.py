"""
agentz.api.billing_webhook
--------------------------
Handles Stripe subscription lifecycle events.

NOT CURRENTLY MOUNTED: this router is not included in agentz/api/main.py
(only `sse_router` is registered there), so it has no live HTTP route today.
The canonical, deployed Stripe webhook for the main app is
server/webhooks/stripe.ts (registered in server/_core/app.ts) — that one
already updates the `subscriptions` table correctly on subscription
lifecycle events. This module exists as a secondary/future integration
point for AgentZ-side access control and is fixed here for correctness
(it previously referenced an unregistered credential key and left the
Supabase update as a no-op comment), but wiring it up requires an explicit
decision on whether AgentZ should own this webhook or only read state that
server/webhooks/stripe.ts already writes.
"""
import logging
import stripe
from agentz.core.credentials import get

logger = logging.getLogger("agentz.billing_webhook")

# Any of these may be configured depending on which brand's Stripe webhook
# endpoint delivered the event (see server/webhooks/stripe.ts for the
# equivalent per-brand secret list); try each until one verifies.
_WEBHOOK_SECRET_KEYS = [
    "stripe_webhook_authichain_secret",
    "stripe_webhook_qron_space_secret",
]


def _get_supabase():
    from supabase import create_client
    return create_client(get("supabase_url"), get("supabase_service_key"))


async def _set_subscription_status(supabase, stripe_customer_id: str, status: str) -> None:
    """Flip `subscriptions.status` for the row matching this Stripe customer."""
    try:
        (
            supabase.table("subscriptions")
            .update({"status": status})
            .eq("stripeCustomerId", stripe_customer_id)
            .execute()
        )
    except Exception as e:
        logger.error(f"Failed to update subscription status for {stripe_customer_id}: {e}")


async def handle_webhook(payload: str, sig_header: str):
    """
    Validates and processes Stripe webhooks.
    """
    event = None
    last_error: Exception | None = None
    for secret_key in _WEBHOOK_SECRET_KEYS:
        webhook_secret = get(secret_key)
        if not webhook_secret:
            continue
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
            break
        except Exception as e:
            last_error = e

    if event is None:
        logger.error(f"Webhook signature verification failed: {last_error}")
        return False

    supabase = _get_supabase()

    if event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")
        status = subscription.get("status", "active")
        logger.info(f"Subscription updated: {subscription['id']} -> status={status}")
        if customer_id:
            await _set_subscription_status(supabase, customer_id, status)

    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")
        logger.info(f"Subscription canceled: {subscription['id']}")
        if customer_id:
            await _set_subscription_status(supabase, customer_id, "cancelled")

    return True
