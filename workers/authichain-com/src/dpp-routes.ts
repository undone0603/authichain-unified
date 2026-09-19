/**
 * DPP thanks/activate HTML served by authichain-com.
 *
 * /dpp marketing HTML stays in index.ts. Checkout, funnel, webhook, and
 * activate POST are not handled here — they fall through to APP_PREFIXES.
 */

const HTML_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
};

function pageShell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <style>
    body{margin:0;background:#050507;color:#f8fafc;font-family:Outfit,system-ui,sans-serif}
    .wrap{max-width:36rem;margin:0 auto;padding:4rem 1.5rem}
    .kicker{font-size:.75rem;letter-spacing:.2em;text-transform:uppercase;color:#67e8f9}
    h1{font-size:1.875rem;margin:.75rem 0}
    p{color:#a1a1aa;line-height:1.6}
    a.btn,button.btn{display:inline-flex;margin-top:2rem;border-radius:.5rem;background:#67e8f9;color:#000;font-weight:600;padding:.75rem 1.25rem;text-decoration:none;border:0;cursor:pointer}
    label{display:block;text-align:left;font-size:.875rem;color:#d4d4d8;margin-top:1.25rem}
    textarea{margin-top:.5rem;width:100%;border-radius:.5rem;border:1px solid #3f3f46;background:#18181b;color:#fff;padding:.5rem .75rem;box-sizing:border-box}
  </style>
</head>
<body><div class="wrap">${body}</div></body>
</html>`;
}

function thanksHtml(sessionId: string, visitId: string): string {
  const qs = new URLSearchParams({ session_id: sessionId });
  if (visitId) qs.set("visit_id", visitId);
  return pageShell(
    "Payment received | AuthiChain",
    `<p class="kicker">Payment received</p>
     <h1>DPP audit provisioned</h1>
     <p>Your workspace access is being granted automatically. Activate now to complete merchant setup — no need to wait for an email reply.</p>
     <a class="btn" href="/dpp/activate?${qs.toString()}">Activate merchant</a>
     <p style="margin-top:1.5rem;font-size:.875rem">A confirmation email with the same link is also on the way.</p>`,
  );
}

function activateHtml(sessionId: string, visitId: string): string {
  if (!sessionId) {
    return pageShell(
      "Missing checkout session | AuthiChain",
      `<h1>Missing checkout session</h1>
       <p>Open this page from your purchase confirmation email or the thank-you page.</p>
       <a class="btn" href="/dpp">Back to DPP offer</a>`,
    );
  }
  return pageShell(
    "Activate DPP audit | AuthiChain",
    `<p class="kicker">Self-serve activation</p>
     <h1>Activate your DPP audit</h1>
     <p>Complete this once. Humans are only notified for exceptions — routine fulfillment is automatic.</p>
     <form id="f">
       <label>Product categories / SKU families in scope
         <textarea name="categories" rows="3" required></textarea></label>
       <label>EU markets you sell into (or plan to)
         <textarea name="markets" rows="2" required></textarea></label>
       <label>Current labeling / QR / NFC setup (or "none")
         <textarea name="labeling" rows="2" required></textarea></label>
       <label>Preferred call windows (optional)
         <textarea name="call_windows" rows="2" placeholder="Timezone + 2–3 options"></textarea></label>
       <button class="btn" type="submit">Activate</button>
       <p id="msg" style="margin-top:1rem"></p>
     </form>
     <script>
       document.getElementById('f').addEventListener('submit', async function (e) {
         e.preventDefault();
         var fd = new FormData(e.target);
         var msg = document.getElementById('msg');
         msg.textContent = 'Saving…';
         try {
           var res = await fetch('/api/dpp/activate', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               session_id: ${JSON.stringify(sessionId)},
               visit_id: ${JSON.stringify(visitId)},
               categories: fd.get('categories'),
               markets: fd.get('markets'),
               labeling: fd.get('labeling'),
               call_windows: fd.get('call_windows')
             })
           });
           var data = await res.json().catch(function () { return {}; });
           if (!res.ok) throw new Error(data.error || data.detail || ('HTTP ' + res.status));
           msg.textContent = 'Activated. Opening dashboard…';
           location.href = data.next || '/dashboard';
         } catch (err) {
           msg.textContent = err.message || 'Activation failed';
         }
       });
     </script>`,
  );
}

function html(body: string): Response {
  return new Response(body, { headers: HTML_HEADERS });
}

/** Thanks/activate HTML, or null so the worker's existing dispatcher continues. */
export function tryHandleDppRoute(request: Request): Response | null {
  const url = new URL(request.url);
  const p = url.pathname;

  if (p === "/dpp/thanks" || p.startsWith("/dpp/thanks/")) {
    return html(
      thanksHtml(
        url.searchParams.get("session_id") || "",
        url.searchParams.get("visit_id") || "",
      ),
    );
  }
  if (p === "/dpp/activate" || p.startsWith("/dpp/activate/")) {
    return html(
      activateHtml(
        url.searchParams.get("session_id") || "",
        url.searchParams.get("visit_id") || "",
      ),
    );
  }
  return null;
}
