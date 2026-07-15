--ebfbae0f1f6c6fb7b47384dd024c693265f1e17053de05d4cf3ec326726c
Content-Disposition: form-data; name="index.js"


// gmail-relay-z v2.0
// Primary: z@authichain.com SMTP via Supabase z-mail fn
// Fallback: authichain@gmail.com relay
// Routes all outbound email through z@authichain.com

let   Z_MAIL    = 'https://nhdnkzhtadfkkluiulhs.supabase.co/functions/v1/z-mail';
let   SUPA_ANON = '***REMOVED***';
const CORS = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};

export default {
    async fetch(req, env) {
        if (env.SUPABASE_URL) Z_MAIL = env.SUPABASE_URL;
    if (env.SUPABASE_ANON_KEY) SUPA_ANON = env.SUPABASE_ANON_KEY;
      const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, {status:204,headers:{'Access-Control-Allow-Origin':'*'}});

    if (url.pathname === '/health')
      return Response.json({ok:true, service:'gmail-relay-z', account:'z@authichain.com', v:'2.0'}, {headers:CORS});

    if (url.pathname === '/emails' && req.method === 'POST') {
      let body = {};
      try { body = await req.json(); } catch { return Response.json({error:'invalid json'}, {status:400,headers:CORS}); }
      const {to, subject, text, html, from, reply_to} = body;
      if (!to || !subject || (!text && !html))
        return Response.json({error:'to/subject/text required'}, {status:400,headers:CORS});

      // Route via z-mail (z@authichain.com SMTP)
      const r = await fetch(Z_MAIL, {
        method: 'POST',
        headers: {'apikey':SUPA_ANON,'Authorization':'Bearer '+SUPA_ANON,'Content-Type':'application/json'},
        body: JSON.stringify({to, subject, text:text||'', html:html||undefined, reply_to:reply_to||'z@authichain.com'})
      }).catch(e => ({ok:false,statusText:e.message}));

      const d = r.json ? await r.json().catch(()=>({})) : {};
      return Response.json({ok:d.ok||false, sent:d.sent||false, from:'z@authichain.com', to, subject, provider:'z-mail'}, {headers:CORS});
    }

    return Response.json({service:'gmail-relay-z', account:'z@authichain.com', v:'2.0',
      endpoints:['/emails (POST)','/health']}, {headers:CORS});
  }
};

--ebfbae0f1f6c6fb7b47384dd024c693265f1e17053de05d4cf3ec326726c--
