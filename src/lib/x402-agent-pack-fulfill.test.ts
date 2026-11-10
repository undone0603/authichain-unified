import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fulfillX402AgentPackIfPaid, revokeX402AgentPackOnReversal } from "./x402-agent-pack-fulfill";
import { X402_AGENT_PACK_PRICE_ID } from "./x402-agent-pack";

const session = {
  id: "cs_live_test_verified_pack",
  livemode: true, mode: "payment", payment_status: "paid", currency: "usd",
  amount_subtotal: 500, amount_total: 500,
  customer_details: { email: "buyer@example.com" },
  payment_intent: "pi_test_verified_pack",
  metadata: { plan: "x402_agent_credits_120" },
};
const line = { data: [{price: {id:X402_AGENT_PACK_PRICE_ID, unit_amount:500, currency:"usd", type:"one_time"}, quantity:1}] };
const stripe = (items=line, metadata: Record<string, string> = {
  plan: "x402_agent_credits_120", stripe_price_id: X402_AGENT_PACK_PRICE_ID,
}) => ({
  checkout: { sessions: { listLineItems: vi.fn(async () => items) } },
  paymentIntents: { retrieve: vi.fn(async () => ({ id: session.payment_intent, metadata })) },
}) as unknown as Stripe;
function store(response: unknown) {
  const rpc=vi.fn(async()=>({data:response,error:null}));
  return {rpc, client:{rpc} as unknown as SupabaseClient};
}

describe("Stripe prepaid grant and reversal ordering",()=>{
  it("atomically grants a paid, live, exact-price pack once",async()=>{
    const db=store("granted");
    expect(await fulfillX402AgentPackIfPaid(session as unknown as Stripe.Checkout.Session, stripe(),db.client)).toBe("granted");
    expect(db.rpc).toHaveBeenCalledWith("grant_x402_agent_pack", {
      p_checkout_session_id: session.id,
      p_payment_intent_id: session.payment_intent,
      p_buyer_email:"buyer@example.com",
    });
  });
  it("treats duplicate delivered sessions as idempotent", async()=>{
    const db=store("existing");
    expect(await fulfillX402AgentPackIfPaid(session as unknown as Stripe.Checkout.Session,stripe(),db.client)).toBe("granted");
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not regrant a paid event delivered after a refund",async()=>{
    const db=store("reversed");
    expect(await fulfillX402AgentPackIfPaid(session as unknown as Stripe.Checkout.Session,stripe(),db.client)).toBe("revoked");
  });
  it("rejects wrong live price without touching the grant ledger",async()=>{
    const db=store("granted");
    const wrong = {data:[{price:{id:"price_different",unit_amount:500,currency:"usd",type:"one_time"},quantity:1}]};
    await expect(fulfillX402AgentPackIfPaid(session as unknown as Stripe.Checkout.Session,stripe(wrong),db.client)).rejects.toThrow(/payment_evidence_mismatch/);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("does not grant an unpaid session",async()=>{
    const db=store("granted");
    expect(await fulfillX402AgentPackIfPaid({...session,payment_status:"unpaid"} as unknown as Stripe.Checkout.Session,stripe(),db.client)).toBe("unpaid");
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("stores a refund tombstone even if no grant was created yet",async()=>{
    const db=store(true);
    const evt={type:"charge.refunded",data:{object:{payment_intent:session.payment_intent}}} as unknown as Stripe.Event;
    await revokeX402AgentPackOnReversal(evt,db.client,X402_AGENT_PACK_PRICE_ID,stripe());
    expect(db.rpc).toHaveBeenCalledWith("reverse_x402_agent_pack",{
      p_payment_intent_id:session.payment_intent,p_status:"refunded",
    });
  });
  it("ignores a refund for unrelated Stripe plans without changing pack credits", async () => {
    const db = store(true);
    const evt = {type: "charge.refunded",data: {object: {payment_intent: session.payment_intent}}} as unknown as Stripe.Event;
    const unrelated = stripe(line, {plan: "starter", stripe_price_id: "price_other"});
    await revokeX402AgentPackOnReversal(evt, db.client, X402_AGENT_PACK_PRICE_ID, unrelated);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("fails closed when Stripe cannot establish which SKU was reversed", async () => {
    const db = store(true);
    const evt = {type: "charge.refunded", data: {object: {payment_intent: session.payment_intent}}} as unknown as Stripe.Event;
    const broken = stripe();
    vi.mocked(broken.paymentIntents.retrieve).mockRejectedValueOnce(new Error("temporary outage"));
    await expect(revokeX402AgentPackOnReversal(evt, db.client, X402_AGENT_PACK_PRICE_ID, broken)).rejects.toThrow(/payment_intent_lookup_failed/);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("rejects failed reversal writes for Stripe retry",async()=>{
    const db=store(false);
    const evt={type:"charge.dispute.created",data:{object:{payment_intent:session.payment_intent}}} as unknown as Stripe.Event;
    await expect(revokeX402AgentPackOnReversal(evt,db.client,X402_AGENT_PACK_PRICE_ID,stripe())).rejects.toThrow(/revocation_failed/);
  });
});
