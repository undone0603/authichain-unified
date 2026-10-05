/**
 * Privacy Policy and Terms of Service for authichain.com.
 *
 * These pages are the public text a checkout, a customer, or a regulator can
 * be shown. They name only the operator, inboxes, and processors the product
 * already uses. They do not invent a corporation, a street address, a DPO,
 * or a privacy@ / legal@ mailbox.
 */

/** Shown at the top of both pages. Change it when the text changes. */
export const LEGAL_EFFECTIVE = "5 October 2026";

const OPERATOR =
  "Zachary Kietzman, a sole proprietor in Michigan, USA, using the brand AuthiChain. AuthiChain is a brand, not a corporation. The SAM legal entity is ZACHARY KIETZMAN.";

const NONAFFILIATION =
  "AuthiChain is an independent brand of Zachary Kietzman and is not affiliated with, endorsed by, or acting on behalf of any government agency.";

export function legalRoute(
  pathname: string
): { kind: "html"; html: string } | { kind: "redirect"; to: string } | null {
  if (pathname === "/privacy" || pathname === "/privacy/") {
    return { kind: "html", html: renderPrivacyPage() };
  }
  if (pathname === "/terms" || pathname === "/terms/") {
    return { kind: "html", html: renderTermsPage() };
  }
  if (
    pathname === "/privacy-policy" ||
    pathname === "/privacy-policy/" ||
    pathname === "/legal/privacy"
  ) {
    return { kind: "redirect", to: "/privacy" };
  }
  if (
    pathname === "/terms-of-service" ||
    pathname === "/terms-of-service/" ||
    pathname === "/tos" ||
    pathname === "/legal/terms"
  ) {
    return { kind: "redirect", to: "/terms" };
  }
  return null;
}

function shell(opts: {
  title: string;
  description: string;
  canonical: string;
  body: string;
}): string {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${opts.title}</title>
<meta name="description" content="${opts.description}">
<link rel="canonical" href="${opts.canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${opts.title}">
<meta property="og:description" content="${opts.description}">
<meta property="og:url" content="${opts.canonical}">
<meta property="og:image" content="https://authichain.com/og-image.png">
<meta name="twitter:card" content="summary">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fff;color:#0f172a;font-family:'Plus Jakarta Sans',system-ui,sans-serif;line-height:1.65}
a{color:#4F46E5}
a:focus-visible{outline:2px solid #4F46E5;outline-offset:3px}
.nav{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:1.2rem 1.5rem;border-bottom:1px solid #e2e8f0;max-width:760px;margin:0 auto}
.logo{font-weight:650;letter-spacing:-.02em;color:#0f172a;text-decoration:none}
.nav span{font-size:.9rem}
.wrap{max-width:760px;margin:0 auto;padding:2.5rem 1.5rem 4rem}
h1{font-size:clamp(1.8rem,4vw,2.4rem);font-weight:650;letter-spacing:-.03em;margin:.4rem 0 1rem}
.meta{color:#64748b;font-size:.9rem;margin-bottom:1.5rem}
h2{font-size:1.15rem;margin:1.75rem 0 .5rem}
p,li{font-size:1rem}
p+p{margin-top:.75rem}
ul{margin:.5rem 0 .5rem 1.25rem}
li+li{margin-top:.35rem}
footer{border-top:1px solid #e2e8f0;padding:2rem 1.5rem 3rem;max-width:760px;margin:0 auto;color:#64748b;font-size:.85rem}
footer p+p{margin-top:.6rem}
</style></head><body>
<div class="nav"><a href="/" class="logo">AuthiChain</a><span><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/contact">Contact</a></span></div>
<div class="wrap">
${opts.body}
</div>
<footer>
<p>${OPERATOR}</p>
<p>${NONAFFILIATION}</p>
<p><a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a> · <a href="/contact">Contact</a> · <a href="mailto:hello@authichain.com">hello@authichain.com</a></p>
</footer>
</body></html>`;
}

export function renderPrivacyPage(): string {
  return shell({
    title: "Privacy Policy — AuthiChain",
    description:
      "What AuthiChain collects, who processes it, and how to ask about your data. Zachary Kietzman, sole proprietor.",
    canonical: "https://authichain.com/privacy",
    body: `<h1>Privacy Policy</h1>
<p class="meta">Effective ${LEGAL_EFFECTIVE}. This is the current policy. The date changes when the text changes.</p>
<h2>Who we are</h2>
<p>${OPERATOR} In this policy, "we" means that person and brand.</p>
<p>${NONAFFILIATION}</p>
<p>This policy covers https://authichain.com, including checkout, the open verifier, and paid agent verification linked from this site. The same person operates qron.space, strainchain.io, govchain.us, and authichain.govchain.us. If one of those sites publishes its own privacy page, that page covers that site. If it does not, this page covers it.</p>
<h2>Information you give us</h2>
<ul>
<li><strong>Checkout email.</strong> Starting a card checkout requires a work email. We use it for the receipt and to follow up if checkout does not finish. We do not add it to a newsletter. The checkout page says this before you continue.</li>
<li><strong>Checkout context.</strong> If the link you used carried them, we pass along a visit id, prospect id, UTM parameters, source, referrer, and referral code so we can tell which page the checkout came from. These go to Stripe with the session.</li>
<li><strong>What you type on Stripe.</strong> Stripe may send us the name and email you enter there, the amount, the plan, and whether the payment succeeded. We do not receive your card number or card security code.</li>
<li><strong>Email you send us.</strong> Messages to hello@authichain.com, support@authichain.com, or proposals@authichain.com, and our replies.</li>
<li><strong>An account, if you create one.</strong> The email and authentication record for a login. Public verification does not require an account.</li>
<li><strong>Product content you ask us to store or publish.</strong> Identifiers, claims, documents, and other material you submit for a passport, a claim file, or a check. Anything you ask us to publish can be read by anyone who has the link or the code.</li>
</ul>
<p>The fingerprint tool at <a href="/anchor">/anchor</a> hashes what you type inside your browser. That text is not sent to us, not stored, and not written to a chain.</p>
<h2>Information collected while you use the site</h2>
<ul>
<li><strong>Request logs.</strong> Cloudflare serves the site and receives the IP address, browser type, and URL of each request in order to deliver the page and block abuse. We use those logs to operate and secure the service. We do not sell them and we do not use them to build an advertising profile.</li>
<li><strong>No advertising cookie.</strong> The public pages do not set an analytics or advertising cookie, and we do not run a third-party advertising pixel.</li>
<li><strong>Referral cookies, only if a referral link set them.</strong> Checkout will read two first-party cookies if your browser already has them: <code>aff_ref</code> and <code>ref_code</code>. They attribute a referral. You can delete them. Checkout still works without them.</li>
<li><strong>A short-lived Cloudflare security cookie.</strong> Cloudflare may set one to tell browsers from abuse. We do not use it to advertise.</li>
</ul>
<h2>Card payments and agent payments</h2>
<p>Card payments happen on Stripe. You review the total on Stripe before you pay. We keep the result Stripe sends back (paid or not), the email, the amount, and the plan. We do not store card numbers.</p>
<p>A paid agent call is a transfer of 0.05 USDC on Base (Circle USDC), unless the live description at <a href="/x402">/x402</a> or <a href="/.well-known/x402">/.well-known/x402</a> states a different figure. The live description controls. The transaction is public on Base. The facilitator published on that page checks the payment proof. We do not receive bank details for that payment. The $QRON token is not a way to pay for AuthiChain services.</p>
<h2>Public records</h2>
<p>A record we publish, and a transaction we send to a public chain such as Polygon (product anchors) or Base (USDC payments), can be read by anyone. We cannot delete it. Do not put a person's private information in a field you intend to publish or anchor.</p>
<p>A signature check reports whether a signature and an anchor match the rules of the open verifier. It does not, by itself, prove that a physical product is genuine, legal, or compliant.</p>
<p><a href="https://api.authichain.com">https://api.authichain.com</a> is a demonstration interface. Its responses are simulated and are not a live record about you or your product.</p>
<h2>Who else processes it</h2>
<p>We do not sell personal information, and we do not share it for cross-context behavioral advertising. Processors that handle it to run the service:</p>
<ul>
<li><strong>Stripe</strong> — card checkout, the amount, and checkout recovery email.</li>
<li><strong>Supabase</strong> — database for accounts, checkout attempts, and product records we store.</li>
<li><strong>Cloudflare</strong> — hosting, delivery, and request security.</li>
<li><strong>Resend</strong> — email about an order you started or paid for, sent from hello@authichain.com. Not a newsletter.</li>
<li><strong>HubSpot</strong> — the order email and name, when we record a paid order so it can be delivered.</li>
<li><strong>The x402 facilitator named on <a href="/x402">/x402</a></strong> — the payment proof for a paid agent call.</li>
</ul>
<p>We also share information when the law requires it, or to respond to a valid legal process.</p>
<p>Separate from this website, we sometimes email a business about the product. That email is not sent because you visited this page. A business that receives one can reply and ask us to stop, and we will.</p>
<h2>How long we keep it</h2>
<p>We keep order and payment records for as long as we need them to deliver what you bought, to handle a dispute, and to meet tax and accounting duties. We keep correspondence until the matter is finished, and for a period after that so we can show what was said. Public chain entries stay public.</p>
<h2>Asking us about your data</h2>
<p>Email <a href="mailto:hello@authichain.com">hello@authichain.com</a> to ask for a copy of the off-chain personal data we hold about you, to correct it, or to delete it. There is no separate privacy mailbox and no appointed data-protection officer. If a law where you live gives you a right to access, correct, delete, or object, use that same address. We will answer.</p>
<p>We cannot delete a public blockchain record. We may also keep a payment record that tax, accounting, or fraud rules require us to keep, and we will tell you if we do.</p>
<h2>Children</h2>
<p>Paid checkout and accounts are for people 18 or older. We do not knowingly collect personal information from anyone under 13. If you believe we have, email hello@authichain.com and we will delete it.</p>
<h2>Security</h2>
<p>Pages are served over TLS. Card data is entered on Stripe, not on our servers. No method of sending data on the internet is perfect.</p>
<h2>Changes</h2>
<p>When we change this policy, we change the date at the top. We do not email every visitor about an edit. If you have a paid order and we change how we handle that order's personal data, we email the work address on the order.</p>
<h2>Contact</h2>
<p>Privacy questions: <a href="mailto:hello@authichain.com">hello@authichain.com</a>. An existing order: <a href="mailto:support@authichain.com">support@authichain.com</a>. Government inquiries: <a href="mailto:proposals@authichain.com">proposals@authichain.com</a>.</p>`,
  });
}

export function renderTermsPage(): string {
  return shell({
    title: "Terms of Service — AuthiChain",
    description:
      "The terms for using AuthiChain checkout, the open verifier, and paid agent verification. Zachary Kietzman, sole proprietor.",
    canonical: "https://authichain.com/terms",
    body: `<h1>Terms of Service</h1>
<p class="meta">Effective ${LEGAL_EFFECTIVE}. This is the current agreement. The date changes when the text changes.</p>
<h2>The agreement</h2>
<p>These terms are between you and ${OPERATOR} "We" means that person and brand.</p>
<p>${NONAFFILIATION}</p>
<p>Using authichain.com, starting checkout, or sending a paid agent call means you agree to these terms and to the <a href="/privacy">Privacy Policy</a>. If you do not agree, do not use the service. These terms cover https://authichain.com. The same person operates qron.space, strainchain.io, govchain.us, and authichain.govchain.us. If one of those sites publishes its own terms, those terms cover that site. If it does not, these terms cover it.</p>
<h2>The service</h2>
<p>AuthiChain lets you publish and check signed product records, buy the plans shown on <a href="/pricing">/pricing</a> and on the checkout page, and pay for an agent verification call. The open verifier at <a href="/protocol">/protocol</a> can be used without an account.</p>
<p>We do not provide legal advice. A readiness file, a claim file, or a passport is substantiation support for the material you supply. It is not a legal opinion, not a government certification, and not a finding that a product may be sold. We are not a GS1 Conformant Resolver.</p>
<p><a href="https://api.authichain.com">https://api.authichain.com</a> returns simulated responses. Do not treat them as a live authenticity record.</p>
<h2>What a verification means</h2>
<p>A verified result means the signature and the anchor match the rules the verifier publishes, including the signer and sender allowlists when those rules require them. It does not mean the underlying statement is true. An issuer can sign a false statement, and the verifier will still report that the signature matches. A fingerprint you compute at <a href="/anchor">/anchor</a> stays in your browser. It is not a certificate and it is not an anchor.</p>
<h2>Accounts</h2>
<p>You do not need an account to read a public record or to pay by card. If you create a login, you are responsible for the credentials and for activity under them. You must be 18 or older to start checkout or to create an account. We may suspend access that breaks these terms or the law.</p>
<h2>Acceptable use</h2>
<p>Do not forge a signature or an anchor, present a simulated demo response as a live record, interfere with the service, or submit content you have no right to publish. Do not use the service to break the law.</p>
<h2>Your content</h2>
<p>You keep ownership of the product data you submit. You give us permission to host, sign, display, and, when you ask us to, publish that data, including on a public verifier and in a public chain transaction. You represent that you have the right to give us that data and to have it published. You are responsible for what it says.</p>
<h2>Our content</h2>
<p>The AuthiChain name, the site, and the software that runs the platform belong to Zachary Kietzman except where a file says otherwise. The protocol specification is Apache-2.0. The platform is not. You may not copy the platform or present the brand as your own.</p>
<h2>Prices and payment</h2>
<p>The price is the price shown on the checkout page before you continue to Stripe. <a href="/pricing">/pricing</a> lists the public plans. You review the total on Stripe before a card is charged. Stripe's terms apply to the card payment.</p>
<p>A plan that the checkout page describes as a one-time charge is charged once. A plan that the checkout page describes as renewing will renew on that schedule until you cancel. Email <a href="mailto:support@authichain.com">support@authichain.com</a> to cancel. Cancellation stops the next renewal. It does not erase a record that was already published.</p>
<p>Email support@authichain.com if you were charged and did not receive what the checkout page described. We do not refund a digital record that was delivered as described, or a USDC transfer that completed. Nothing in this paragraph limits a right that the law where you live says cannot be waived.</p>
<p>Paid agent verification costs 0.05 USDC per call on Base, sent to the address published at <a href="/x402">/x402</a>, unless that page or <a href="/.well-known/x402">/.well-known/x402</a> states a different figure. The live description controls. Network fees are yours. A proof that does not match is rejected and is not treated as paid. The $QRON token is not accepted as payment.</p>
<h2>Delivery</h2>
<p>What you bought is what the pricing page and the checkout page describe: access, a file, a published record, or a paid verification, as that page states. Delivery of a digital good is complete when we send the access email or publish the record you paid for.</p>
<h2>Disclaimers</h2>
<p>The service is provided as is and as available. We do not warrant that a record will be accepted by a regulator, a retailer, a marketplace, or a court. We do not warrant uninterrupted access. Chain congestion, a wallet you do not control, and a third-party outage can stop a payment or a lookup.</p>
<h2>Liability</h2>
<p>To the extent the law allows, we are not liable for indirect, incidental, special, or consequential damages, or for lost profits, or for a decision you or someone else makes from a verification result. Our total liability for a claim about a paid order is limited to the amount you paid us for that order. For use of the public verifier that you did not pay for, you are not entitled to damages beyond what the law refuses to let us exclude.</p>
<p>This limit does not apply to a liability the law where you live says cannot be limited, including liability for fraud or for injury that a statute protects.</p>
<p>If you publish product data, you will cover claims that you had no right to publish it, or that the data you supplied was false, including reasonable legal fees, to the extent the law allows.</p>
<h2>Disputes</h2>
<p>These terms are governed by the laws of the State of Michigan, USA, except where a non-waivable law where you live applies instead. Courts in Michigan may hear a dispute. You may also bring a claim in a court the law requires us to accept. We do not require arbitration.</p>
<h2>Changes</h2>
<p>We change these terms by editing this page and the date at the top. New use after that date is use under the new terms. An order already paid stays on the terms in effect on the day you paid, for that order.</p>
<h2>Contact</h2>
<p>Questions about these terms: <a href="mailto:hello@authichain.com">hello@authichain.com</a>. An existing order: <a href="mailto:support@authichain.com">support@authichain.com</a>. Government inquiries: <a href="mailto:proposals@authichain.com">proposals@authichain.com</a>.</p>`,
  });
}
