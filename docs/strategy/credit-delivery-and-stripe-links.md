# Credit Delivery + 10-Industry Stripe-Link Strategy

> **Imported from Google Drive** (doc "Continue") into the repo on 2026-06-13. This captures a go-to-market + provisioning design that previously lived only in a Google Doc.

> **Reconciliation note (added on import):** The deployed payment path (`server/webhooks/stripe.ts`) provisions by **plan/subscription**, not by the `seal_credits` credit model below, and does **not** perform the 30% $QRON route. Treat the credit model as a documented alternative/enhancement. The $QRON revenue-routing must remain behind the payout approval gate — do not auto-wire fund movement into the live payment path.

---

## 1. The "Credit Delivery" loop (design)

Goal: when a customer pays via a Stripe "Smart Link", their dashboard credit balance must update — otherwise they pay $99 and the dashboard stays at zero.

Approach: in the Stripe checkout call, pass the Supabase User ID as `client_reference_id`. A Cloudflare Worker handles `checkout.session.completed` and PATCHes the user's `profiles` row.

```js
// Worker environment variables required:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

export default {
  async fetch(request, env) {
    const payload = await request.json();

    if (payload.type === 'checkout.session.completed') {
      const session = payload.data.object;

      // 1. Extract the "DNA" from metadata
      const userId = session.client_reference_id; // Supabase User ID
      const industryId = session.metadata.industry_id;
      const creditAmount = parseInt(session.metadata.credits) || 1000;
      const amountPaid = session.amount_total / 100;

      // 2. Calculate the $QRON revenue route (30%)
      //    NOTE: fund movement — keep behind the payout approval gate.
      const qronReward = amountPaid * 0.30;
      console.log(`Routing $${qronReward} to $QRON Pool`);

      // 3. Update Supabase credits & industry
      const supabaseResponse = await fetch(
        `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            seal_credits: creditAmount,       // increments their balance
            industry_id: industryId,          // sets their industry dashboard
            subscription_status: 'active',
          }),
        }
      );

      return new Response('User Credits Provisioned', { status: 200 });
    }
    return new Response('Event Ignored', { status: 200 });
  }
};
```

**Schema prerequisite:** the `profiles` table needs a `seal_credits` column (and `industry_id`, `subscription_status`) for the worker to write to.

---

## 2. "Sales HQ" (Airtable) — managing 10 industry Stripe links

Because each vertical gets its own Stripe links, an Airtable base prevents sending a "Cannabis" link to a "Luxury Watch" manufacturer.

Columns:
- **Industry Name** (text)
- **UUID** (per-industry identifier)
- **Starter Link** (the $99 Stripe URL)
- **Growth Link** (the $299 Stripe URL)
- **Target Leads** (linked to a companies table: LVMH, Rolex, etc.)

---

## 3. Pilot Outreach (Month 1 goal: 10 customers)

Target the **Luxury Goods** sector first — highest pain point on counterfeits.

**The "High-Value" pitch:**
> "We've developed an AI AutoFlow that identifies counterfeit [Product Type] with 99% accuracy. We are looking for one partner in the Luxury sector to join our pilot program. We'll secure your first 1,000 units for free to prove the tech. Are you open to a 5-minute demo?"

---

## Open items
- Add the `seal_credits` / `industry_id` / `subscription_status` columns to `profiles` (SQL migration) if the credit model is adopted.
- Decide credit model vs. subscription model as canonical (or run both: subscriptions = recurring, credit packs = one-time).
- Keep the 30% $QRON route gated — never auto-send.
