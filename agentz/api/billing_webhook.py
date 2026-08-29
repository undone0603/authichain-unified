"""
agentz.api.billing_webhook
--------------------------
Handles Stripe subscription lifecycle events.
"""
import logging
import stripe
from agentz.core.credentials import get

logger = logging.getLogger("agentz.billing_webhook")

async def handle_webhook(payload: str, sig_header: str):
    """
    Validates and processes Stripe webhooks.
    """
    webhook_secret = get("stripe_webhook_secret")
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except Exception as e:
        logger.error(f"Webhook signature verification failed: {e}")
        return False

    if event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        logger.info(f"Subscription updated: {subscription['id']}")
        # Update user access status in Supabase
        
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        logger.info(f"Subscription canceled: {subscription['id']}")
        # Revoke user access in Supabase
        
    return True
