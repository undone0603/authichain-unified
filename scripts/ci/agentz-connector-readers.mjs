/** Explicit, read-only connector adapters. Each tool is injected by the authenticated host. */
const req=(v,label)=>{if(typeof v!=='string'||!v.trim())throw Error(label+' required');return v};
const numeric=(v,label)=>{if(!Number.isSafeInteger(v)||v<=0)throw Error(label+' required');return v};
export function createAgentZReaders({hubspot,airtable,gmail,stripe,airtableConfig,stripeContext}) {
 if(!hubspot||!airtable||!gmail||!stripe||!airtableConfig||!stripeContext?.stripe_context||stripeContext.livemode!==true)throw Error('read-only connector bindings and live-mode context required');
 return Object.freeze({
  hubspotDeal:async ids=>{numeric(ids.hubspotDealId,'hubspotDealId');return hubspot.get_crm_objects({objectType:'DEAL',objectIds:[ids.hubspotDealId],properties:['dealname','dealstage','amount','description','hs_lastmodifieddate']})},
  airtableEvidence:async ids=>{req(ids.airtableRecordId,'airtableRecordId');return airtable.list_records_for_table({baseId:airtableConfig.baseId,tableId:airtableConfig.tableId,recordIds:[ids.airtableRecordId],fieldIds:airtableConfig.fieldIds,pageSize:1,link_id:airtableConfig.link_id})},
  gmailReply:async ids=>{const email=req(ids.buyerEmail,'buyerEmail');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('invalid email');return gmail.search_emails({query:`from:${email} -in:spam -in:trash`,max_results:25})},
  stripeCheckout:async ids=>{const id=req(ids.checkoutSessionId,'checkoutSessionId');if(!/^cs_(live|test)_/.test(id))throw Error('invalid session id');return stripe.stripe_api_read({stripe_context:stripeContext.stripe_context,livemode:true,stripe_api_operation_id:'GetCheckoutSessionsSession',parameters:{id}})},
  stripePayment:async ids=>{const id=req(ids.paymentIntentId,'paymentIntentId');if(!/^pi_/.test(id))throw Error('invalid payment intent id');return stripe.stripe_api_read({stripe_context:stripeContext.stripe_context,livemode:true,stripe_api_operation_id:'GetPaymentIntentsIntent',parameters:{id}})},
  stripeBalance:async ids=>{const id=req(ids.balanceTransactionId,'balanceTransactionId');if(!/^txn_/.test(id))throw Error('invalid balance id');return stripe.stripe_api_read({stripe_context:stripeContext.stripe_context,livemode:true,stripe_api_operation_id:'GetBalanceTransactionsId',parameters:{id}})},
  stripePayout:async ids=>{const id=req(ids.payoutId,'payoutId');if(!/^po_/.test(id))throw Error('invalid payout id');return stripe.stripe_api_read({stripe_context:stripeContext.stripe_context,livemode:true,stripe_api_operation_id:'GetPayoutsPayout',parameters:{id}})}
 });
}
