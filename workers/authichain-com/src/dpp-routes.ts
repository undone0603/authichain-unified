/**
 * DPP thanks/activate HTML served by authichain-com.
 *
 * /dpp marketing HTML stays in index.ts. Checkout, funnel, webhook, and
 * activate POST are not handled here — they fall through to APP_PREFIXES.
 */

import { checkoutActivationHref } from "../../../src/lib/checkout-confirmation";

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

function esc(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    c =>
      (
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }) as Record<string, string>
      )[c] as string
  );
}

/**
 * A Stripe Checkout redirect is user-controlled and cannot establish
 * settlement or entitlement. Always render a neutral page until a trusted
 * server-side session lookup / entitlement check can confirm fulfillment.
 * The activation API remains the authority for access.
 */
function thanksHtml(sessionId: string, visitId: string): string {
  const activationHref = checkoutActivationHref(sessionId, visitId);
  const nextStep = activationHref
    ? `<p>If you completed checkout, allow the payment confirmation to process. This page has not verified your payment.</p>
       <a class="btn" href="${esc(activationHref)}">Check activation eligibility</a>`
    : `<p>No valid checkout reference was supplied. Return to the offer or use the link from your confirmation email.</p>
       <a class="btn" href="/dpp">Back to DPP offer</a>`;

  return pageShell(
    "Checkout status unverified | AuthiChain",
    `<p class="kicker">Checkout status unverified</p>
     <h1>We cannot confirm payment here</h1>
     ${nextStep}
     <p>This page does not confirm a payment, open a workspace, or grant credits. Activation requires a separate server-side eligibility check.</p>`
  );
}

function activateHtml(sessionId: string, visitId: string): string {
  if (!sessionId) {
    return pageShell(
      "Missing checkout session | AuthiChain",
      `<h1>Missing checkout session</h1>
       <p>Open this page from your purchase confirmation email or the thank-you page.</p>
       <a class="btn" href="/dpp">Back to DPP offer</a>`
    );
  }
  return pageShell(
    "Activate workspace | AuthiChain",
    `<p class="kicker">Self-serve activation</p>
     <h1>Activate your workspace</h1>
     <p>Complete this once. This records merchant activation for this workspace. It does not include a written assessment or a scheduled call. After it saves, you can download a field file of what you typed and what is still missing. That file is not a battery passport, not a certificate, and not EU registry filing.</p>
     <form id="f">
       <label>Product categories / SKU families in scope
         <textarea name="categories" rows="3" required></textarea></label>
       <label>EU markets you sell into (or plan to)
         <textarea name="markets" rows="2" required></textarea></label>
       <label>Current labeling / QR / NFC setup (or "none")
         <textarea name="labeling" rows="2" required></textarea></label>
       <p style="margin:1rem 0 0.5rem;color:#94a3b8;font-size:0.9rem">Optional pack figures (same as the free /battery-passport gap map). Leave blank if unknown.</p>
       <label>Pack model <input name="pack_model" type="text" /></label>
       <label>Stated energy (Wh) <input name="stated_wh" type="number" step="any" min="0" /></label>
       <label>Rated capacity (Ah) <input name="ah" type="number" step="any" min="0" /></label>
       <label>Nominal voltage (V) <input name="nominal_v" type="number" step="any" min="0" /></label>
       <button class="btn" type="submit">Activate workspace</button>
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
               pack_model: fd.get('pack_model') || undefined,
               stated_wh: fd.get('stated_wh') || undefined,
               ah: fd.get('ah') || undefined,
               nominal_v: fd.get('nominal_v') || undefined
             })
           });
           var data = await res.json().catch(function () { return {}; });
           if (!res.ok) throw new Error(data.error || data.detail || ('HTTP ' + res.status));
           msg.textContent = 'Activated.';
           if (data.importer_file) {
             var blob = new Blob([JSON.stringify(data.importer_file, null, 2)], { type: 'application/json' });
             var url = URL.createObjectURL(blob);
             var a = document.createElement('a');
             a.href = url;
             a.download = 'authichain-dpp-importer-file.json';
             a.textContent = 'Download field file (JSON)';
             msg.appendChild(document.createElement('br'));
             msg.appendChild(a);
           }
         } catch (err) {
           msg.textContent = err.message || 'Activation failed';
         }
       });
     </script>`
  );
}

function html(body: string): Response {
  return new Response(body, { headers: HTML_HEADERS });
}

/** Thanks/activate HTML, or null so the worker's existing dispatcher continues. */
export function tryHandleDppRoute(request: Request): Response | null {
  const url = new URL(request.url);
  const p = url.pathname;

  if (
    p === "/dpp/thanks" ||
    p.startsWith("/dpp/thanks/") ||
    p === "/thanks" ||
    p.startsWith("/thanks/") ||
    p === "/success" ||
    p.startsWith("/success/")
  ) {
    return html(
      thanksHtml(
        url.searchParams.get("session_id") || "",
        url.searchParams.get("visit_id") || ""
      )
    );
  }
  if (p === "/dpp/activate" || p.startsWith("/dpp/activate/")) {
    return html(
      activateHtml(
        url.searchParams.get("session_id") || "",
        url.searchParams.get("visit_id") || ""
      )
    );
  }
  return null;
}
