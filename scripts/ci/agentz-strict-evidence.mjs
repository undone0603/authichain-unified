/** Credential-free, read-only, fail-closed validation of independently corroborated commercial records. */
import {createHash} from 'node:crypto';
const text=x=>typeof x==='string'&&x.trim().length>0;
const validDate=x=>text(x)&&Number.isFinite(Date.parse(x));
const proof=x=>x&&text(x.sourceId)&&text(x.sourceSystem)&&validDate(x.observedAt)&&x.verified===true;
const eq=(...v)=>v.every(x=>text(x))&&v.every(x=>x===v[0]);
const digest=x=>'sha256:'+createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const OFFER_CENTS=Object.freeze({mcp_connect:150000,a2a_connect:150000,mcp_a2a_launch:250000});
export function assessStrictWin(x={}) {
 const fails=[]; const fail=(condition,code)=>{if(!condition)fails.push(code)};
 const {buyer,order,checkout,payment,charge,balance,payout,bank,delivery,acceptance}=x;
 const price=OFFER_CENTS[order?.packageId];
 fail(Boolean(price&&proof(order)&&eq(order.currency,'usd')&&order.amountCents===price&&text(order.orderId)&&text(order.sowVersion)), 'accepted_order');
 fail(proof(buyer)&&buyer.humanConfirmed===true&&buyer.budgetApproved===true&&buyer.canCommit===true&&buyer.notFounder===true&&eq(buyer.buyerId,order?.buyerId), 'independent_buyer_authority');
 fail(proof(checkout)&&checkout.status==='complete'&&checkout.paymentStatus==='paid'&&checkout.amountTotal===price&&eq(checkout.orderId,order?.orderId)&&eq(checkout.buyerId,order?.buyerId)&&text(checkout.paymentIntentId), 'paid_checkout_order_link');
 fail(proof(payment)&&payment.status==='succeeded'&&payment.amountReceived===price&&eq(payment.id,checkout?.paymentIntentId)&&eq(payment.orderId,order?.orderId)&&text(payment.latestCharge), 'payment_intent_and_order_link');
 fail(proof(charge)&&charge.paid===true&&charge.refunded===false&&charge.disputed===false&&charge.amount===price&&eq(charge.id,payment?.latestCharge)&&eq(charge.paymentIntentId,payment?.id), 'captured_charge');
 fail(proof(balance)&&balance.amount>0&&balance.status==='available'&&eq(balance.source,charge?.id)&&eq(balance.currency,'usd')&&text(balance.id), 'available_balance_transaction');
 fail(proof(payout)&&payout.status==='paid'&&payout.amount>0&&eq(payout.currency,'usd')&&text(payout.id)&&Array.isArray(payout.includedBalanceTransactionIds)&&payout.includedBalanceTransactionIds.includes(balance?.id), 'traceable_paid_payout');
 fail(proof(bank)&&bank.reconciled===true&&eq(bank.payoutId,payout?.id)&&eq(bank.currency,'usd')&&bank.amount===payout?.amount&&text(bank.bankReference), 'bank_reconciliation');
 fail(proof(delivery)&&delivery.delivered===true&&eq(delivery.orderId,order?.orderId)&&eq(delivery.buyerId,order?.buyerId)&&/^sha256:[a-f0-9]{64}$/.test(delivery.sha256||'')&&text(delivery.artifactId), 'fulfillment_order_link');
 fail(proof(acceptance)&&acceptance.humanAccepted===true&&eq(acceptance.orderId,order?.orderId)&&eq(acceptance.buyerId,order?.buyerId)&&eq(acceptance.artifactSha256,delivery?.sha256)&&eq(acceptance.sowVersion,order?.sowVersion), 'accepted_delivery_link');
 return {decision:fails.length?'UNVERIFIED':'WIN_VERIFIED',win:fails.length===0,missing:fails,evidenceFingerprint:digest({orderId:order?.orderId||null,paymentIntentId:payment?.id||null,chargeId:charge?.id||null,bankReference:bank?.bankReference||null,artifactSha256:delivery?.sha256||null}),sideEffects:false};
}
/** Adapters are dependency-injected, limited to read operations; caller authenticates each source separately. */
export async function collectReadOnlyEvidence(adapters, ids) {
 if(!adapters||!ids||!text(ids.orderId)||!text(ids.buyerId))throw Error('buyer/order identifiers required');
 const allowed=['hubspotDeal','airtableEvidence','gmailReply','stripeCheckout','stripePayment','stripeBalance','stripePayout'];
 const report={};
 for(const key of allowed){if(typeof adapters[key]!=='function'){report[key]={status:'UNAVAILABLE'};continue;}
  try {const v=await adapters[key](Object.freeze({...ids}));report[key]={status:'RETRIEVED_UNVERIFIED',value:v};}
  catch {report[key]={status:'UNAVAILABLE'};}
 }
 return Object.freeze(report);
}
