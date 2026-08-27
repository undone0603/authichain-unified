// resend-relay v1.2
// Authenticated email sending via Resend API
// From: authichain.com with full SPF+DKIM+DMARC
// SECURITY FIX: API key moved from source code to environment variable binding
// v1.2: /batch now uses Resend's batch endpoint (single request) instead of
//       sequential sends with 100ms sleeps — saves ~5s wall time per batch.

const CORS = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};

export default {
  async fetch(req, env) {
    const RESEND_KEY = env.RESEND_API_KEY;
    if (!RESEND_KEY) {
      return Response.json({error:'RESEND_API_KEY not configured'},{status:500,headers:CORS});
    }

    const path = new URL(req.url).pathname;
    if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:CORS});

    if (path === '/health') return Response.json({
      ok: true, service: 'resend-relay', version: '1.2',
      from_domain: 'authichain.com',
      auth: 'SPF+DKIM+DMARC', limit: '3000/day'
    },{headers:CORS});

    if (path === '/emails' && req.method === 'POST') {
      let body = {}; try { body = await req.json(); } catch {}
      const { to, subject, text, html, from, reply_to } = body;

      if (!to || !subject || (!text && !html)) {
        return Response.json({error:'to, subject, and text/html required'},{status:400,headers:CORS});
      }

      const fromAddr = from?.includes('AuthiChain') || from?.includes('authichain')
        ? from.replace(/<[^>]+>/, '<noreply@authichain.com>').replace(/^([^<]+)$/, '$1 <noreply@authichain.com>')
        : (from || 'AuthiChain <noreply@authichain.com>');

      const finalFrom = fromAddr.includes('@authichain.com') ? fromAddr
        : fromAddr.replace(/<[^>]+>/, '<noreply@authichain.com>');

      const payload = {
        from: finalFrom,
        to: Array.isArray(to) ? to : [to],
        subject,
        ...(text && { text }),
        ...(html && { html }),
        ...(reply_to && { reply_to })
      };

      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer '+RESEND_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await r.json();
      return Response.json({
        ok: r.ok,
        id: result.id,
        sent: r.ok ? 1 : 0,
        from: finalFrom,
        to,
        error: result.message
      },{headers:CORS});
    }

    if (path === '/batch' && req.method === 'POST') {
      let body = {}; try { body = await req.json(); } catch {}
      const emails = body.emails || [];
      if (!emails.length) return Response.json({error:'emails array required'},{status:400,headers:CORS});

      // Use Resend's batch endpoint (single request, up to 100 per call)
      // instead of sequential sends with 100ms sleeps — saves ~5s wall time
      // per 50-email batch and avoids CPU-limit risk on the free tier.
      const batch = emails.slice(0, 100).map(email => ({
        from: email.from || 'AuthiChain <noreply@authichain.com>',
        to: Array.isArray(email.to) ? email.to : [email.to],
        subject: email.subject,
        text: email.text
      }));

      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: 'Bearer '+RESEND_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(batch)
      });

      const data = await r.json().catch(e => ({ error: String(e) }));
      // Resend batch returns an array of { id } objects (one per email) on success
      const results = Array.isArray(data)
        ? data.map((item, i) => ({ to: batch[i].to, id: item.id, sent: !!item.id }))
        : [{ error: data.message || data.error || 'batch failed' }];
      const sent = results.filter(r => r.sent).length;
      return Response.json({ok: r.ok, sent, total: emails.length, results},{headers:CORS});
    }

    return Response.json({service:'resend-relay',endpoints:['/health','/emails','/batch']},{headers:CORS});
  }
};
