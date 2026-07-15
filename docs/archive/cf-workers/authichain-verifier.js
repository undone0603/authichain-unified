--b030dd169920e2f91bde5da55d6b48f385fa91c422ec49191e7481d055c1
Content-Disposition: form-data; name="index.js"


// authichain-verifier — serves /verify/* from authichain.com
// Routes to Supabase edge function for certificate lookup
const SUPA_FN = 'https://nhdnkzhtadfkkluiulhs.supabase.co/functions/v1/authichain-verify';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/html; charset=utf-8' };

const HTML = (cert, certId) => cert ? `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${cert.valid ? '✅ Authentic' : '❌ Invalid'} — ${cert.product_name || cert.product_id} | AuthiChain</title>
<meta name="robots" content="noindex">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0a;color:#e5e5e5;font-family:system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{background:#111;border:2px solid ${cert.valid ? '#c9a227' : '#ef4444'};border-radius:20px;padding:40px;max-width:480px;width:100%;text-align:center}
.badge{font-size:3rem;margin-bottom:16px}
.status{font-size:1.4rem;font-weight:900;color:${cert.valid ? '#c9a227' : '#ef4444'};margin-bottom:8px}
.brand{color:#888;font-size:14px;margin-bottom:24px}
.field{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #1e1e1e;font-size:14px}
.label{color:#666}.value{color:#e5e5e5;font-weight:600;word-break:break-all;max-width:60%;text-align:right}
.cert{font-family:monospace;font-size:11px;color:#c9a227;margin-top:24px;padding:12px;background:#0a0a0a;border-radius:8px;word-break:break-all}
.footer{margin-top:24px;font-size:12px;color:#444}
.logo{color:#c9a227;font-weight:900;font-size:18px;margin-bottom:4px}
</style>
</head><body><div class="card">
<div class="badge">${cert.valid ? '◆' : '✗'}</div>
<div class="logo">AUTHICHAIN</div>
<div class="brand">Blockchain Product Authentication</div>
<div class="status">${cert.valid ? '✅ AUTHENTIC PRODUCT' : '❌ CERTIFICATE REVOKED'}</div>
<div class="field"><span class="label">Brand</span><span class="value">${cert.brand}</span></div>
<div class="field"><span class="label">Product</span><span class="value">${cert.product_name || cert.product_id}</span></div>
${cert.sku ? `<div class="field"><span class="label">SKU</span><span class="value">${cert.sku}</span></div>` : ''}
<div class="field"><span class="label">Verified</span><span class="value">${new Date(cert.issued_at).toLocaleDateString()}</span></div>
<div class="field"><span class="label">Scans</span><span class="value">${cert.scan_count}</span></div>
<div class="cert">CERT: ${cert.cert_id}<br>HASH: ${cert.product_hash?.slice(0,32)}...</div>
<div class="footer">Powered by AuthiChain · authichain.com</div>
</div></body></html>` :
`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Not Found — AuthiChain</title>
<style>body{background:#0a0a0a;color:#e5e5e5;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}.card{background:#111;border:2px solid #ef4444;border-radius:20px;padding:40px;max-width:400px}</style>
</head><body><div class="card"><div style="font-size:3rem;margin-bottom:16px">⚠️</div>
<h1 style="color:#ef4444;margin-bottom:8px">Certificate Not Found</h1>
<p style="color:#888;margin-bottom:16px">ID: ${certId}</p>
<p style="color:#666;font-size:14px">This product cannot be verified. It may be counterfeit or the certificate ID is incorrect.</p>
<div style="margin-top:24px;font-size:12px;color:#444">AuthiChain · authichain.com</div>
</div></body></html>`;

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const certId = url.pathname.replace('/verify/', '').replace('/verify', '').trim().toUpperCase();
    if (!certId) return new Response('AuthiChain Verify — provide /verify/{cert_id}', { headers: CORS });

    // Fetch from edge function
    const r = await fetch(`${SUPA_FN}/verify/${certId}`, { signal: AbortSignal.timeout(10000) });
    const cert = r.ok ? await r.json() : null;
    
    // Return JSON for API calls, HTML for browsers
    const accepts = req.headers.get('accept') || '';
    if (accepts.includes('application/json') || url.searchParams.get('json') === '1') {
      return new Response(JSON.stringify(cert || { valid: false, cert_id: certId }), 
        { status: cert ? 200 : 404, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    return new Response(HTML(cert?.valid !== false ? cert : null, certId), 
      { status: cert?.valid !== false ? 200 : 404, headers: CORS });
  }
};

--b030dd169920e2f91bde5da55d6b48f385fa91c422ec49191e7481d055c1--
