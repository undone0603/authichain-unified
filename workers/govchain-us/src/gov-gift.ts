/**
 * Free packet for DoD-seeking firms. No invented SBIR award, no gov-mint.
 * Live URLs only. Paid path is AuthiChain DPP $299 or /onboard.
 */
import { catalogPaymentLinkHtml } from "../../../src/lib/checkout-email";
import {
  ESTATE_BASE_CSS,
  ESTATE_FONTS_LINK,
  estateCtaBand,
  estateCssVars,
  estateFeatures,
  estateFooter,
  estateHero,
  estateNav,
  estateSkipLink,
} from "../../_shared/estate-landing.ts";
import { GOVCHAIN_DPP_CHECKOUT } from "../../_shared/estate-pricing.ts";

const HTML_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=300",
};

export const GOV_GIFT_PATHS = [
  "/gift",
  "/sbir-packet",
  "/apex-packet",
] as const;

export function isGovGiftPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return (GOV_GIFT_PATHS as readonly string[]).includes(p);
}

export function renderGovGiftPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Free DoD packet — GovChain</title>
<meta name="description" content="Free, live packet for Michigan firms selling into DoD: origin-claim brief, SBIR explainer, SAM.gov-style opportunity feed. No invented award. Onboard or EU DPP Readiness $299 when you are ready.">
<link rel="canonical" href="https://govchain.us/gift">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#1d4ed8">
${ESTATE_FONTS_LINK}
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Free DoD packet — GovChain",
    url: "https://govchain.us/gift",
    description:
      "Free live packet: Made in America origin brief, SBIR/SVIP explainer, opportunity feed. No claimed award.",
  })}</script>
<style>
${estateCssVars("govchain")}
${ESTATE_BASE_CSS}
.gift-list { list-style: none; display: grid; gap: 12px; max-width: 720px; }
.gift-list li { color: var(--text-dim); }
.gift-list a { font-weight: 650; }
</style>
</head>
<body>
${estateSkipLink()}
${estateNav(
  "govchain",
  [
    { href: "/gift", label: "Free packet" },
    { href: "/opportunities", label: "Opportunities" },
    { href: "/pricing", label: "Pricing" },
  ],
  { href: "/onboard", label: "Request access" }
)}
<main id="main">
${estateHero({
  eyebrow: "Free packet",
  title: "Take this to a contracting officer. Nothing here is an award.",
  lede: "For Michigan firms selling into DoD and other agencies: three live pages you can attach to a Phase I or agency packet today. We do not claim an SBIR award, a NIST certification, or a minted government NFT. When you want a paid origin record, EU DPP Readiness is $299.",
  actions: [
    { href: "/onboard", label: "Request GovChain access", primary: true },
    {
      href: "https://authichain.com/made-in-america",
      label: "Made in America brief",
      primary: false,
    },
  ],
})}
<section class="estate-section">
  <div class="wrap">
    <h2>What you get without paying</h2>
    <ul class="gift-list">
      <li><a href="https://authichain.com/made-in-america">Made in America origin brief</a> — FTC 16 CFR Part 323 and EO 14392 context. A signed record documents a claim; it does not replace meeting the standard.</li>
      <li><a href="https://govchain.us/p/sbir-svip-blockchain-document-verification">SBIR / SVIP document-verification explainer</a> — how a hashed record attaches to a proposal. Not a submitted pitch.</li>
      <li><a href="https://govchain.us/opportunities">Live opportunity feed</a> — public notices scored on this estate. Refresh, do not screenshot a stale PDF.</li>
      <li><a href="https://govchain.us/onboard">GovChain onboard</a> — the intake form production already proxies. No invented GovChain subscription SKU.</li>
    </ul>
  </div>
</section>
${estateFeatures(
  "What this packet is not",
  "Overclaiming kills contracting conversations. These lines stay off the page.",
  [
    {
      title: "Not an award",
      body: "No SBIR/STTR/SVIP win is asserted here. If you need a proposal, write it from primary sources.",
    },
    {
      title: "Not a mint",
      body: "This page does not mint a government NFT. On-chain seals wait on a live contract with bytecode.",
    },
    {
      title: "Not a cannabis pitch",
      body: "DoD-seeking manufacturers get origin and document-hash copy. StrainChain Farm is a different SKU.",
    },
  ],
  "honesty"
)}
${estateCtaBand({
  title: "When the packet is not enough",
  lede: "Onboard is the GovChain path. EU DPP Readiness ($299) is the published AuthiChain checkout for origin documentation. Enter a work email so abandoned-checkout recovery can reach you.",
  emailCheckout: {
    action: GOVCHAIN_DPP_CHECKOUT,
    label: "Start DPP checkout — $299",
  },
  actions: [
    { href: "/onboard", label: "Request access", primary: true },
    {
      href: "https://authichain.com/partners/brief",
      label: "Partner brief",
      primary: false,
    },
  ],
})}
<p class="wrap" style="padding-bottom:48px">${catalogPaymentLinkHtml({
    planId: "dpp_readiness",
    label: "Pay $299 on Stripe",
  })}</p>
</main>
${estateFooter(
  "govchain",
  [
    {
      heading: "Packet",
      links: [
        { href: "/gift", label: "This packet" },
        { href: "/onboard", label: "Onboard" },
        { href: "/opportunities", label: "Opportunities" },
      ],
    },
    {
      heading: "Origin",
      links: [
        {
          href: "https://authichain.com/made-in-america",
          label: "Made in America",
        },
        {
          href: "https://authichain.com/partners/brief",
          label: "Partner brief",
        },
        { href: "https://authichain.com/pricing", label: "AuthiChain pricing" },
      ],
    },
  ],
  "Free packet — no claimed award"
)}
</body>
</html>`;
}

export function tryHandleGovGift(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (!isGovGiftPath(new URL(request.url).pathname)) return null;
  return new Response(renderGovGiftPage(), { headers: HTML_HEADERS });
}
