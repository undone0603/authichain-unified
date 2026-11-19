import { describe, expect, it } from "vitest";
import { catalogOffers } from "../../../src/lib/plans.ts";
import {
  isOffersFeedPath,
  offersFeedItems,
  renderOffersFeed,
  tryHandleOffersFeed,
} from "./offers-feed.ts";

describe("offers RSS feed", () => {
  it("serves RSS 2.0 at /feed.xml, /rss.xml and /feed", async () => {
    for (const path of ["/feed.xml", "/rss.xml", "/feed"]) {
      const res = tryHandleOffersFeed(new Request(`https://authichain.com${path}`));
      expect(res?.status).toBe(200);
      expect(res?.headers.get("Content-Type")).toBe("application/rss+xml; charset=utf-8");
      const body = await res!.text();
      expect(body.startsWith('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"')).toBe(true);
      expect(body).toContain('<atom:link href="https://authichain.com/feed.xml" rel="self"');
    }
  });

  it("ignores other paths and non-GET methods", () => {
    expect(isOffersFeedPath("/feeds")).toBe(false);
    expect(tryHandleOffersFeed(new Request("https://authichain.com/llms.txt"))).toBeNull();
    expect(
      tryHandleOffersFeed(new Request("https://authichain.com/feed.xml", { method: "POST" }))
    ).toBeNull();
  });

  it("lists every paid catalog offer at its plans.ts price and checkout", () => {
    const items = offersFeedItems();
    for (const offer of catalogOffers()) {
      const item = items.find(i => i.guid === `authichain-offer-${offer.id}`);
      expect(item?.link).toBe(offer.checkout);
      expect(item?.title).toContain(`$${offer.usd}`);
    }
  });

  it("keeps GUIDs unique and escapes XML", () => {
    const guids = offersFeedItems().map(i => i.guid);
    expect(new Set(guids).size).toBe(guids.length);
    expect(renderOffersFeed()).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it("makes no passport or certification claim", () => {
    const text = renderOffersFeed();
    expect(text).toContain("Does not issue a passport or certify compliance");
    expect(text).not.toMatch(/certified compliant|guarantees? compliance/i);
  });
});
