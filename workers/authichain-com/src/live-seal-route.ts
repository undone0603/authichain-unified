/**
 * Public founder mint on Base. Runs before APP_PREFIXES so /verify/live is
 * not treated as a product id. The page names the published mint. It does
 * not check a signature and it does not read the chain.
 */
const HOLDER = "authichain.base.eth";
const CONTRACT = "0x34370EDA96e0C7e47f46F18e2D3a7298C241E16F";
const MINT_TX =
  "0xa07d0bbadcc958b3f6fc8d81acda16a54c4bcfdb5e86bd2ce186e27f5752ab3b";

const PAGE_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "private, no-store",
  "cdn-cache-control": "no-store",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy":
    "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-ancestors 'none'",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      allow: "GET, HEAD",
    },
  });
}

function page(): Response {
  const scan = `https://basescan.org/tx/${MINT_TX}`;
  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>This seal is already on Base</title>
<main style="max-width:40rem;margin:2rem auto;padding:0 1rem;font-family:system-ui,sans-serif">
  <h1>This seal is already on Base.</h1>
  <p>Founder example. The mint transaction is published on Base. This page does not check a signature, and a signed record is not an inspection.</p>
  <h2>Public proof</h2>
  <dl>
    <dt>Holder</dt><dd>${HOLDER}</dd>
    <dt>Contract</dt><dd>${CONTRACT}</dd>
    <dt>Mint transaction</dt><dd><a href="${scan}">view on BaseScan</a></dd>
    <dt>Open protocol</dt><dd><a href="/protocol">run the verifier yourself</a></dd>
  </dl>
  <p>What this does not prove: that any physical object is genuine. A signed record is not an inspection.</p>
  <p><a href="/checkout/starter">Buy Starter — $29</a> · <a href="/generate">Generate your own Living QR</a></p>
  <h2>FAQ</h2>
  <h3>Does this prove the product is authentic?</h3>
  <p>No. It shows the published mint on Base. It does not run a signature check. Physical genuineness is a separate inspection.</p>
  <h3>Can I do this for my products?</h3>
  <p>Yes. Self-serve generation and the $29 Starter Pack. No call required.</p>
  <h3>Is the public certificate registry live?</h3>
  <p>In development. This page shows the mint that already exists.</p>
</main>`;
  return new Response(html, { headers: PAGE_HEADERS });
}

export function tryHandleLiveSeal(request: Request): Response | null {
  const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  if (path !== "/verify/live") return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json(405, { error: "method_not_allowed" });
  }
  return page();
}
