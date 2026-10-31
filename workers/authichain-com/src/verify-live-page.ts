/**
 * Reserved path. Not a certificate number.
 *
 * authichain.com proxies /verify/* to the edge router, which treats the path
 * segment as a registry id. That made /verify/live a 404 "No record found"
 * for the id "live" even after src/app/verify/live/page.tsx shipped.
 * Answer it here, before APP_PREFIXES. Copy matches that page.
 * A signed anchor is not a physical inspection.
 */

const MINT_TX =
  "0xa07d0bbadcc958b3f6fc8d81acda16a54c4bcfdb5e86bd2ce186e27f5752ab3b";
const HOLDER = "authichain.base.eth";
const CONTRACT = "0x34370EDA96e0C7e47f46F18e2D3a7298C241E16F";

export function isVerifyLivePath(pathname: string): boolean {
  const bare = pathname.replace(/\/+$/, "") || "/";
  return bare.toLowerCase() === "/verify/live";
}

export function renderVerifyLivePage(): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>This seal is already on Base. | AuthiChain</title>
<meta name="description" content="Founder example. Signature check plus an on-chain anchor. This does not prove a physical object is genuine.">
<link rel="canonical" href="https://authichain.com/verify/live">
<meta name="robots" content="index, follow">
<style>
:root{color-scheme:dark}
body{margin:0;background:#09090b;color:#fafafa;font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:40rem;margin:0 auto;padding:2.5rem 1.25rem 3rem}
h1{font-size:1.75rem;line-height:1.2;margin:0 0 .75rem}
h2{font-size:1.05rem;margin:1.75rem 0 .5rem}
p,dd{color:#d4d4d8}
a{color:#00ffd1}
dl{margin:.5rem 0 0}
dt{margin-top:.85rem;font-size:.75rem;letter-spacing:.04em;text-transform:uppercase;color:#a1a1aa}
dd{margin:.15rem 0 0;word-break:break-all}
.actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem}
.actions a{display:inline-flex;align-items:center;min-height:44px;padding:0 1rem;border-radius:.5rem;text-decoration:none;font-weight:700}
.actions a.primary{background:#00ffd1;color:#000}
.actions a.ghost{border:1px solid #3f3f46;color:#fafafa}
</style></head><body>
<main>
<h1>This seal is already on Base.</h1>
<p>Founder example. Signature check + on-chain anchor. You can verify it without trusting us.</p>
<h2>Public proof</h2>
<dl>
<dt>Holder</dt><dd>${HOLDER}</dd>
<dt>Contract</dt><dd>${CONTRACT}</dd>
<dt>Mint tx</dt><dd><a href="https://basescan.org/tx/${MINT_TX}">view on BaseScan</a></dd>
<dt>Open protocol</dt><dd><a href="/protocol">run the verifier yourself</a></dd>
</dl>
<p>What this does not prove: that any physical object is genuine. A signed record is not an inspection.</p>
<div class="actions">
<a class="primary" href="/generate">Generate your own Living QR</a>
<a class="ghost" href="/pricing">Buy Starter — $29</a>
</div>
<h2>FAQ</h2>
<h3>Does this prove the product is authentic?</h3>
<p>No. It proves the claim was signed and the anchor hash matches what is on Base. Physical genuineness is a separate inspection.</p>
<h3>Can I do this for my products?</h3>
<p>Yes. Self-serve generation and the $29 Starter Pack. No call required.</p>
<h3>Is the public certificate registry live?</h3>
<p>In development. This page shows the live path that already exists.</p>
</main>
</body></html>`;
}
