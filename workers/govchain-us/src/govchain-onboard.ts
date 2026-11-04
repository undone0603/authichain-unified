/**
 * GovChain-specific, no-payment contractor inquiry. This is a presentation and
 * lead-capture adapter, NOT a government application or a paid order.
 */
const HEADERS: Record<string, string> = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'private, no-store, max-age=0',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
};

function html(heading: string, body: string, status = 200): Response {
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${heading} | GovChain</title><style>body{margin:0;background:#090e1a;color:#f0f7ff;font-family:system-ui,sans-serif}main{max-width:38rem;margin:7vh auto;padding:2rem}h1{font-size:2rem}p{line-height:1.6;color:#c0d4e8}label{display:block;margin:1.3rem 0 .4rem}input:not([type=hidden]){box-sizing:border-box;width:100%;padding:.8rem;border:1px solid #7a95ad;background:#101d2d;color:#fff;border-radius:6px}button,.link{display:inline-block;padding:.8rem 1rem;background:#bfe7ff;color:#09213b;border:0;border-radius:6px;margin-top:1.4rem;text-decoration:none;font-weight:700}small{display:block;color:#b2c4d5;margin-top:1rem}.hp{position:absolute;left:-10000px;height:1px;overflow:hidden}</style></head><body><main><a href="/" style="color:#bfe7ff">GovChain home</a><h1>${heading}</h1>${body}</main></body></html>`;
  return new Response(page, { status, headers: HEADERS });
}

export function renderGovchainOnboard(): Response {
  return html('Request GovChain contractor access', `<p>Tell us where to send details about federal opportunity intelligence, fit scoring, and evidence-ready contractor workflows. This is an early-access inquiry, not a government filing, certification, or purchase.</p>
<form method="POST" action="/onboard" enctype="application/x-www-form-urlencoded">
<label for="company">Company or contact</label><input id="company" name="company" autocomplete="organization" required maxlength="120">
<label for="email">Work email</label><input id="email" type="email" name="email" autocomplete="email" required maxlength="254">
<div class="hp" aria-hidden="true"><label for="website">Leave blank</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div>
<button type="submit">Request GovChain information</button>
<small>We use this information for your inquiry and asynchronous follow-up, not a newsletter. No payment is collected here.</small></form>
<p><a href="/opportunities" style="color:#bfe7ff">View public federal opportunities</a></p>`);
}

export type GovchainLead = {
  email: string;
  name: string;
  source: 'govchain_onboard';
  product_interest: 'govchain';
  page_url: 'https://govchain.us/onboard';
};

export async function submitGovchainOnboard(
  request: Request,
  forward: (lead: GovchainLead) => Promise<Response>,
): Promise<Response> {
  if (!/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
    return html('Invalid request', '<p>Use the inquiry form. No request was saved.</p><a class="link" href="/onboard">Try again</a>', 415);
  }
  const n = Number(request.headers.get('content-length') || 0);
  if (n > 2048) return html('Request too large', '<p>No request was saved.</p>', 413);
  // Enforce the size cap while reading: request.text() buffers the entire
  // request before checking length, allowing unbounded memory use if a
  // client omits Content-Length or lies about it.
  let raw: string;
  const reader = request.body?.getReader();
  if (!reader) return html('Invalid request', '<p>No request was saved.</p>', 400);
  try {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2048) {
        void reader.cancel().catch(() => {});
        return html('Request too large', '<p>No request was saved.</p>', 413);
      }
      chunks.push(value);
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    raw = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return html('Invalid request', '<p>No request was saved.</p>', 400);
  } finally {
    reader.releaseLock();
  }
  const values = new URLSearchParams(raw);
  if (values.get('website')) {
    // Honeypot. Do not forward bot submissions; never claim stored lead data.
    return html('Inquiry received', '<p>Thank you.</p>');
  }
  if (values.getAll('email').length !== 1 || values.getAll('company').length !== 1) {
    return html('Invalid inquiry', '<p>Enter one work email and company or contact. No request was saved.</p><a class="link" href="/onboard">Try again</a>', 400);
  }
  const email = (values.get('email') || '').trim();
  const company = (values.get('company') || '').trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || company.length < 1 || company.length > 120) {
    return html('Invalid inquiry', '<p>Check your work email and company or contact. No request was saved.</p><a class="link" href="/onboard">Try again</a>', 400);
  }
  const lead: GovchainLead = {
    email, name: company, source: 'govchain_onboard',
    product_interest: 'govchain', page_url: 'https://govchain.us/onboard',
  };
  try {
    const result = await forward(lead);
    if (!result.ok || (await result.json() as { ok?: boolean }).ok !== true) throw new Error('Lead capture not confirmed');
  } catch {
    return html('Request not saved', '<p>The inquiry service is unavailable. No confirmation was received. Please retry later.</p><a class="link" href="/onboard">Retry inquiry</a>', 503);
  }
  return html('GovChain inquiry recorded', '<p>Your inquiry was saved. We can follow up by email about contractor workflows. No payment, government filing, or certification occurred.</p><a class="link" href="/opportunities">Browse opportunities</a>');
}
