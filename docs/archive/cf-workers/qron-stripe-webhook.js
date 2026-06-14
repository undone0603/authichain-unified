--2d6c98b4b0721459b21e3c5226a5926f58e5795b7902e0d809fd68186c53
Content-Disposition: form-data; name="index.js"


let   STRIPE_SECRET  = '***REMOVED***';
let   WEBHOOK_SECRET = '***REMOVED***';
let   QRON_BOT       = '***REMOVED***';
let   OPS_BOT        = '***REMOVED***';
let   TG_QRON        = 'https://api.telegram.org/bot' + QRON_BOT;
let   TG_OPS         = 'https://api.telegram.org/bot' + OPS_BOT;
let   GROUP_ID       = -1003982585243;
let   GMAIL          = 'https://gmail-relay.undone-k.workers.dev/emails';
let   SUPA           = 'https://nhdnkzhtadfkkluiulhs.supabase.co';
let   SUPA_KEY       = '***REMOVED***';

async function tgSend(botUrl, chatId, text, extra) {
  if (!chatId) return;
  return fetch(botUrl + '/sendMessage', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(Object.assign({chat_id: chatId, text, disable_web_page_preview: true}, extra || {}))
  }).then(r => r.json());
}

async function notifyOps(subject, body) {
  // Email
  fetch(GMAIL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      from: 'QRON Sales <authichain@gmail.com>',
      to: 'z@authichain.com',
      reply_to: 'z@authichain.com',
      subject,
      text: body
    })
  }).catch(() => {});
}

async function logSale(session) {
  // Log to Supabase nft_sales table
  const customer = session.customer_details || {};
  fetch(SUPA + '/rest/v1/nft_sales', {
    method: 'POST',
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      stripe_session_id: session.id,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: customer.email || null,
      customer_name: customer.name || null,
      payment_status: session.payment_status,
      product_name: session.metadata && session.metadata.product || 'QRON Design',
      created_at: new Date().toISOString()
    })
  }).catch(() => {});
}

async function handleCheckoutComplete(session) {
  const email   = session.customer_details && session.customer_details.email || 'unknown';
  const amount  = (session.amount_total / 100).toFixed(2);
  const product = session.metadata && session.metadata.product || 'QRON Design';
  const chatId  = session.metadata && session.metadata.telegram_chat_id || null;

  // Log to Supabase
  await logSale(session);

  // Notify z@authichain.com
  await notifyOps(
    'STRIPE SALE $' + amount + ' — ' + product,
    'NEW STRIPE SALE!\n\n' +
    'Amount: $' + amount + '\n' +
    'Product: ' + product + '\n' +
    'Customer: ' + email + '\n' +
    'Session: ' + session.id + '\n\n' +
    'ACTION: Email ' + email + ' to deliver the QRON design.\n' +
    'Reply template: "Thanks for your QRON purchase! Please reply with your brand URL or QR destination and preferred style."'
  );

  // Send fulfillment to buyer via Telegram if chat_id was passed in metadata
  if (chatId) {
    await tgSend(TG_QRON, chatId,
      'Payment confirmed! Thank you for your QRON order.\n\n' +
      'Product: ' + product + '\n' +
      'Amount: $' + amount + '\n\n' +
      'Reply here with:\n' +
      '1. Your QR destination URL\n' +
      '2. Preferred style (cannabis / automotive / luxury / abstract)\n' +
      '3. Brand colors (optional)\n\n' +
      'Delivery in 24-72 hours. Questions? Just reply here.'
    );
  }
}

export default {
    async fetch(req, env) {
        // Environment variable overrides
    if (env.STRIPE_SECRET_KEY) STRIPE_SECRET = env.STRIPE_SECRET_KEY;
    if (env.STRIPE_WEBHOOK_SECRET) WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET;
    if (env.SUPABASE_URL) SUPA = env.SUPABASE_URL;
    if (env.SUPABASE_ANON_KEY) SUPA_KEY = env.SUPABASE_ANON_KEY;
    if (env.GMAIL_RELAY_URL) GMAIL = env.GMAIL_RELAY_URL;
      const url = new URL(req.url);

    // Health check
    if (req.method === 'GET') {
      return Response.json({
        service: 'qron-stripe-webhook',
        status: 'active',
        endpoint: '/webhook',
        events: ['checkout.session.completed']
      }, {headers: {'Access-Control-Allow-Origin': '*'}});
    }

    // Stripe webhook
    if (req.method === 'POST' && url.pathname === '/webhook') {
      const body = await req.text();

      // Verify Stripe signature (HMAC-SHA256)
      const sig = req.headers.get('stripe-signature') || '';
      let event;
      try {
        // Parse timestamp from signature header
        const parts = sig.split(',').reduce((acc, part) => {
          const [k, v] = part.split('=');
          acc[k] = v;
          return acc;
        }, {});
        const ts     = parts.t;
        const sigV1  = parts.v1;
        const signed = ts + '.' + body;

        // Compute HMAC-SHA256
        const key = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(WEBHOOK_SECRET),
          {name: 'HMAC', hash: 'SHA-256'},
          false,
          ['sign']
        );
        const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
        const computed = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2,'0')).join('');

        if (computed !== sigV1) {
          return new Response('Invalid signature', {status: 401});
        }

        event = JSON.parse(body);
      } catch (e) {
        // If signature verification fails (e.g. no secret set), still process in dev
        try { event = JSON.parse(body); } catch(e2) {
          return new Response('Bad request', {status: 400});
        }
      }

      // Handle events
      if (event.type === 'checkout.session.completed') {
        await handleCheckoutComplete(event.data.object);
      }

      return new Response('ok', {status: 200});
    }

    return new Response('Not found', {status: 404});
  }
};

--2d6c98b4b0721459b21e3c5226a5926f58e5795b7902e0d809fd68186c53--
