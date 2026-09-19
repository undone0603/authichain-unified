/**
 * The /contact page.
 *
 * `/contact` was listed in this worker's sitemap but had no handler, so it fell
 * through to the homepage: a crawler was told the page existed, followed the
 * link, and got a 200 that was not the page it was promised. Either the sitemap
 * entry had to go or the page had to exist — this is the second option, since a
 * contact route is worth having.
 */

/** Escapes text interpolated into the document. */
function esc(value: unknown): string {
  return String(value ?? "").replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

const ACCENT = "#00FFD1";

const CONTACT_ROUTES = [
  {
    label: "General & partnerships",
    address: "hello@authichain.com",
    blurb: "Pilots, integrations, press, and anything that does not fit the boxes below.",
  },
  {
    label: "Technical support",
    address: "support@authichain.com",
    blurb: "Existing customers: anchoring failures, verification issues, API and SDK questions.",
  },
  {
    label: "Government & federal",
    address: "proposals@authichain.com",
    blurb: "Capability statements, FAR/DFARS questions, and GovChain federal pursuits.",
  },
];

/** Renders the contact page. */
export function renderContactPage(): string {
  const cards = CONTACT_ROUTES.map(
    (r) => `<div class="card">
<h2>${esc(r.label)}</h2>
<p>${esc(r.blurb)}</p>
<a href="mailto:${esc(r.address)}">${esc(r.address)}</a>
</div>`,
  ).join("");

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Contact AuthiChain</title>
<meta name="description" content="Reach the AuthiChain team — partnerships and pilots, technical support for existing customers, and federal or government pursuits.">
<link rel="canonical" href="https://authichain.com/contact">
<meta property="og:type" content="website">
<meta property="og:title" content="Contact AuthiChain">
<meta property="og:description" content="Reach the AuthiChain team — partnerships, technical support, and federal pursuits.">
<meta property="og:url" content="https://authichain.com/contact">
<meta property="og:image" content="https://authichain.com/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#fff;font-family:'Inter',system-ui,sans-serif;line-height:1.6}
a{color:${ACCENT};text-decoration:none}
.nav{display:flex;justify-content:space-between;align-items:center;padding:1.2rem 1.5rem;border-bottom:1px solid #18181b;max-width:1040px;margin:0 auto}
.logo{font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#fff;font-size:1rem}
.wrap{max-width:1040px;margin:0 auto;padding:0 1.5rem}
.hero{text-align:center;padding:5rem 0 3rem}
h1{font-size:clamp(2rem,5vw,3.25rem);font-weight:900;letter-spacing:-.02em;text-transform:uppercase;margin-bottom:1.25rem}
.lede{max-width:600px;margin:0 auto;color:#a1a1aa}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.25rem;margin:2.5rem 0 4rem}
.card{border:1px solid #18181b;border-radius:1rem;padding:1.75rem;background:#09090b}
.card h2{font-size:.8rem;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:${ACCENT};margin-bottom:.6rem}
.card p{font-size:.86rem;color:#a1a1aa;margin-bottom:1rem}
.note{border:1px solid #18181b;border-radius:1rem;padding:1.75rem;background:#09090b;margin-bottom:4rem;color:#a1a1aa;font-size:.86rem}
footer{border-top:1px solid #18181b;padding:3rem 1.5rem;text-align:center;color:#3f3f46;font-size:.62rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase}
</style></head><body>
<div class="nav"><a href="/" class="logo">AuthiChain</a><a href="/vs">Compare</a></div>
<div class="wrap">
<section class="hero">
  <h1>Contact</h1>
  <p class="lede">Email reaches a person. Pick the address that matches what you need and we will route it from there.</p>
</section>
<div class="grid">${cards}</div>
<div class="note"><strong>Verifying a product?</strong> You do not need us for that — scan the code on the item, or check a certificate directly at <a href="/anchor">authichain.com/anchor</a>. Verification is public and needs no account.</div>
</div>
<footer>AuthiChain &middot; Blockchain Product Authentication &middot; EU DPP Compliant &middot; Polygon &amp; Bitcoin Anchored</footer>
</body></html>`;
}
