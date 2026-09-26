# Close only a stranger's $29 or $49 payment

Issue: none
Source: AuthiChain Board autopilot
Written: 2026-09-23T15:02:37.645Z

## Outcome
Recognize a **first-sale close** only when Stripe reports a **succeeded** charge of **2900 or 4900** cents from a non-internal payer email. Surface existing $29 / $49 Checkout links first on high-traffic pages. No dunning, no outreach re-enable, no pending/$9.31 as revenue.

## Files to touch
- `apps/web/app/(marketing)/page.tsx` (and any existing pricing/CTA partials already routed)
- `apps/web/lib/stripe/links.ts` (export existing Payment Link URLs only)
- `workers/stripe-webhook/src/index.ts`
- `workers/stripe-webhook/src/close.ts` (new small helper)
- `supabase/migrations/YYYYMMDD_first_sale_close.sql`
- `packages/shared/src/close.ts` (amount + email guards)

## Acceptance checks
- [ ] Webhook treats `charge.succeeded` / `payment_intent.succeeded` with `amount_received ∈ {2900, 4900}` as close candidates
- [ ] Payer email not in `{authichain@gmail.com, undone.k@gmail.com}` (case-insensitive)
- [ ] Pending, incomplete, or $931 amounts never increment close/revenue
- [ ] At most one close row per payer email (first sale only)
- [ ] No dunning sends; outreach queues untouched
- [ ] $29 then $49 Stripe links are the first CTAs on home and existing open pricing surfaces
- [ ] No new secrets committed; env-only Stripe keys

## Minimal patch sketch
```ts
// packages/shared/src/close.ts
export const CLOSE_CENTS = new Set([2900, 4900]);
export const INTERNAL = new Set([
  "authichain@gmail.com",
  "undone.k@gmail.com",
]);

export function isStrangerClose(amount: number, email?: string | null) {
  if (!CLOSE_CENTS.has(amount)) return false;
  const e = (email ?? "").trim().toLowerCase();
  if (!e || INTERNAL.has(e)) return false;
  return true;
}

// workers/stripe-webhook/src/close.ts
import { isStrangerClose } from "@authichain/shared/close";

export async function maybeRecordFirstClose(sb: Supabase, ev: StripeEvent) {
  const obj = ev.data.object as Stripe.PaymentIntent | Stripe.Charge;
  const amount =
    "amount_received" in obj ? obj.amount_received : obj.amount;
  const email =
    "billing_details" in obj
      ? obj.billing_details?.email
      : obj.receipt_email;
  if (obj.status !== "succeeded" || !isStrangerClose(amount ?? 0, email))
    return;

  const { data } = await sb
    .from("closes")
    .select("id")
    .eq("payer_email", email!.toLowerCase())
    .maybeSingle();
  if (data) return; // first sale only

  await sb.from("closes").insert({
    payer_email: email!.toLowerCase(),
