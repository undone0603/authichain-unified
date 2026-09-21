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
  return String(value ?? "").replace(
    /[<>&"']/g,
    c =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string
  );
}

const ACCENT = "#4F46E5";

const CONTACT_ROUTES = [
  {
    label: "General & partnerships",
    address: "hello@authichain.com",
    blurb:
      "Pilots, integrations, press, and anything that does not fit the boxes below.",
  },
  {
    label: "Technical support",
    address: "support@authichain.com",
    blurb:
      "Existing customers: anchoring failures, verification issues, API and SDK questions.",
  },
  {
    label: "Government & federal",
    address: "proposals@authichain.com",
    blurb:
      "Capability statements, FAR/DFARS questions, and GovChain federal pursuits.",
  },
];

/** Renders the contact page. */
export function renderContactPage(): string {
  const cards = CONTACT_ROUTES.map(
    r => `<div class="card">
<h2>${esc(r.label)}</h2>
<p>${esc(r.blurb)}</p>
<a href="mailto:${esc(r.address)}">${esc(r.address)}</a>
</div>`
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
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fff;color:#0f172a;font-family:'Plus Jakarta Sans',system-ui,sans-serif;line-height:1.6}
a{color:${ACCENT};text-decoration:none}
a:focus-visible{outline:2px solid ${ACCENT};outline-offset:3px}
.nav{display:flex;justify-content:space-between;align-items:center;padding:1.2rem 1.5rem;border-bottom:1px solid #e2e8f0;max-width:1040px;margin:0 auto}
.logo{font-weight:650;letter-spacing:-.02em;color:#0f172a;font-size:1.05rem}
.wrap{max-width:1040px;margin:0 auto;padding:0 1.5rem}
.hero{text-align:left;padding:4rem 0 2rem}
h1{font-size:clamp(2rem,5vw,3rem);font-weight:600;letter-spacing:-.03em;margin-bottom:1.25rem}
.lede{max-width:600px;color:#475569}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.25rem;margin:2.5rem 0 4rem}
.card{border:1px solid #e2e8f0;border-radius:10px;padding:1.75rem;background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.06)}
.card h2{font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${ACCENT};margin-bottom:.6rem}
.card p{font-size:.86rem;color:#475569;margin-bottom:1rem}
.note{border:1px solid #e2e8f0;border-radius:10px;padding:1.75rem;background:#f8fafc;margin-bottom:4rem;color:#475569;font-size:.86rem}
footer{border-top:1px solid #e2e8f0;padding:3rem 1.5rem;text-align:left;color:#64748b;font-size:.8rem}
</style></head><body>
<div class="nav"><a href="/" class="logo">AuthiChain</a><span><a href="/pricing">Pricing</a> · <a href="/x402">x402</a> · <a href="/dpp">DPP brief</a></span></div>
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
