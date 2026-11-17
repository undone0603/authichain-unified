/**
 * RSS 2.0 feed of what AuthiChain offers, for feed readers, directories and
 * agents. Paid items come from plans.ts (catalogOffers), so prices never drift
 * from checkout. GUIDs are stable and items carry no dates, so an unchanged
 * offer is never re-announced.
 */
import { catalogOffers } from "../../../src/lib/plans.ts";
import { x402PriceUsd } from "../../../src/lib/x402.ts";

const FEED_URL = "https://authichain.com/feed.xml";

const FEED_PATHS = new Set([
  "/feed.xml",
  "/feed.xml/",
  "/rss.xml",
  "/rss.xml/",
  "/feed",
  "/feed/",
]);

export function isOffersFeedPath(pathname: string): boolean {
  return FEED_PATHS.has(pathname);
}

type FeedItem = { guid: string; title: string; link: string; description: string };

function xml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const FREE_ITEMS: FeedItem[] = [
  {
    guid: "authichain-free-battery-passport-gap-map",
    title: "Free EU battery passport gap map",
    link: "https://authichain.com/battery-passport",
    description:
      "See which battery passport fields you already have for one model and which need supplier evidence. Passports apply from 18 February 2027 for EV, LMT and industrial batteries over 2 kWh under Regulation (EU) 2023/1542. Free, no sign-up. Does not issue a passport or certify compliance.",
  },
  {
    guid: "authichain-free-dpp-readiness-check",
    title: "Free EU Digital Product Passport readiness check",
    link: "https://authichain.com/dpp-check",
    description:
      "A short questionnaire that returns a 0-100 readiness score, gaps and the dated obligation for your product category. Informational only.",
  },
  {
    guid: "authichain-mcp-server",
    title: "AuthiChain MCP server for agents",
    link: "https://authichain.com/mcp/install",
    description:
      "Remote MCP server at https://authichain.com/mcp (com.authichain/authichain in the MCP Registry). Seven free tools, including provenance lookup, signed-record checks and the DPP readiness check. A2A agent card at https://authichain.com/.well-known/agent-card.json.",
  },
  {
    guid: "authichain-x402-verify",
    title: `Pay-per-call verification for agents ($${x402PriceUsd()} USDC on Base)`,
    link: "https://authichain.com/x402",
    description: `An unpaid POST https://authichain.com/api/x402 returns HTTP 402 for $${x402PriceUsd()} USDC on Base. A signed result shows a record is registered and unaltered; it does not prove real-world claims about the product.`,
  },
];

export function offersFeedItems(): FeedItem[] {
  const paid = catalogOffers().map(offer => ({
    guid: `authichain-offer-${offer.id}`,
    title: `${offer.name}: $${offer.usd}${offer.priceSuffix ?? ""}`,
    link: offer.checkout,
    description: `${offer.name}, $${offer.usd}${offer.priceSuffix ?? ""}. Checkout: ${offer.checkout}. Not an audit, certification or legal advice.`,
  }));
  return [...FREE_ITEMS, ...paid];
}

export function renderOffersFeed(): string {
  const items = offersFeedItems()
    .map(
      item =>
        `<item><title>${xml(item.title)}</title><link>${xml(item.link)}</link>` +
        `<guid isPermaLink="false">${xml(item.guid)}</guid>` +
        `<description>${xml(item.description)}</description></item>`
    )
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>` +
    `<title>AuthiChain: offers and free tools</title>` +
    `<link>https://authichain.com</link>` +
    `<description>EU Digital Product Passport and battery passport tools, an MCP server for agents, and x402 pay-per-call verification.</description>` +
    `<language>en</language>` +
    `<atom:link href="${FEED_URL}" rel="self" type="application/rss+xml"/>` +
    items +
    `</channel></rss>`
  );
}

export function tryHandleOffersFeed(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (!isOffersFeedPath(new URL(request.url).pathname)) return null;
  return new Response(request.method === "HEAD" ? null : renderOffersFeed(), {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
