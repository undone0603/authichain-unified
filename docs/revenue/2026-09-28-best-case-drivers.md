# Best-case drivers — machine contract

1. Zero idle session burn — GET/HEAD /checkout never creates a Stripe session.
2. Credit breakage — Starter $29 SET 100 gens, never expire, refillOnInvoicePaid=false.
3. Unified grant rail — both rails SET generations_limit = PLAN_CREDITS[plan], used=0. Never +=.

Kill: buy.stripe.com public href, Starter-as-subscription, webhook +=, paid $29 / 0 gens.
