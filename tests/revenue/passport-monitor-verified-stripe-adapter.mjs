/**
 * DORMANT server-only adapter. No routes import this file.
 * Stripe must verify the raw payload's endpoint HMAC; only a service-role
 * Supabase client may call the restricted, transactional Postgres RPC.
 * Never accept events, customer IDs or entitlements from client JSON.
 */
export const MONITOR_PRICE = 'price_1USJytGqTruSqV8TpbDuW6bH';
const id = (v,prefix) => typeof v === 'string' && new RegExp('^'+prefix+'_[A-Za-z0-9_]+$').test(v);
const strId = obj => typeof obj === 'string' ? obj : obj?.id;
const linePrice = l => strId(l?.pricing?.price_details?.price) || strId(l?.price);
const linePeriod = l => l?.period?.start !== undefined && l?.period?.end !== undefined ?
  {periodStart:l.period.start,periodEnd:l.period.end} : null;

export function mapVerifiedStripeEvent(event, expectedLivemode) {
  if (!event || event.livemode !== expectedLivemode || !id(event.id,'evt'))
    return {ok:false,reason:'mode_or_event_identity'};
  const obj=event.data?.object;
  if (!obj) return {ok:false,reason:'missing_object'};
  if (event.type==='invoice.paid' || event.type==='invoice.payment_failed') {
    const lines=obj.lines?.data;
    if (!Array.isArray(lines) || obj.lines.has_more===true) return {ok:false,reason:'invoice_lines_incomplete'};
    const matched=lines.filter(l=>linePrice(l)===MONITOR_PRICE);
    if (matched.length!==1) return {ok:false,reason:'no_unique_subscription_price'};
    const l=matched[0];
    const subscriptionId = strId(obj.parent?.subscription_details?.subscription) ||
      strId(l.parent?.subscription_item_details?.subscription) || strId(obj.subscription);
    const customerId=strId(obj.customer);
    if (!id(subscriptionId,'sub') || !id(customerId,'cus') || !id(obj.id,'in') ||
        obj.currency!=='usd') return {ok:false,reason:'invalid_invoice_identity'};
    const period=linePeriod(l);
    if (!period || !Number.isSafeInteger(period.periodStart) || !Number.isSafeInteger(period.periodEnd) ||
        period.periodStart<0 || period.periodEnd<=period.periodStart)
      return {ok:false,reason:'invalid_invoice_period'};
    if (event.type==='invoice.paid' &&
      (obj.status!=='paid' || obj.paid!==true || obj.paid_out_of_band===true ||
       !Number.isSafeInteger(obj.amount_paid) || obj.amount_paid<=0 || obj.amount_remaining!==0))
      return {ok:false,reason:'invoice_not_settled'};
    return {ok:true,value:{
      id:event.id,type:event.type,customerId,subscriptionId,priceId:MONITOR_PRICE,
      invoiceId:obj.id,amountPaid:event.type==='invoice.paid'?obj.amount_paid:0,
      currency:'usd',...period
    }};
  }
  if (event.type==='customer.subscription.deleted') {
    const subscriptionId=obj.id, customerId=strId(obj.customer);
    if (!id(subscriptionId,'sub') || !id(customerId,'cus') || obj.status!=='canceled' ||
       !Array.isArray(obj.items?.data) ||
       obj.items.data.filter(x=>linePrice(x)===MONITOR_PRICE).length!==1)
      return {ok:false,reason:'subscription_identity_or_status'};
    return {ok:true,value:{id:event.id,type:event.type,customerId,subscriptionId,priceId:MONITOR_PRICE}};
  }
  return {ok:false,reason:'event_type_ignored'};
}

export function createDormantPassportMonitorWebhook({stripe,endpointSecret,supabase,expectedLivemode=false}) {
  if (!stripe?.webhooks?.constructEventAsync || !endpointSecret?.startsWith('whsec_') ||
      typeof supabase?.rpc!=='function') throw new Error('signed Stripe verifier and service-role Supabase client required');
  return async function processRawStripeWebhook(rawBody,signature) {
    if (!(typeof rawBody==='string' || Buffer.isBuffer(rawBody)) ||
        Buffer.byteLength(rawBody)>65536 || typeof signature!=='string' || !signature)
      return {ok:false,reason:'invalid_webhook_transport'};
    // No fallback to JSON.parse or caller-supplied payment data.
    const event=await stripe.webhooks.constructEventAsync(rawBody,signature,endpointSecret);
    const mapped=mapVerifiedStripeEvent(event,expectedLivemode);
    if (!mapped.ok) return mapped;
    const {data,error}=await supabase.rpc('passport_monitor_apply_verified_event',{p_event:mapped.value});
    if (error) throw error; // Trigger webhook retry rather than silently losing entitlements.
    return data;
  };
}
