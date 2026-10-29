import { describe, expect, it } from "vitest";
import {
  HOSTS,
  INDEXNOW_KEY,
  indexNowBody,
  parseSitemap,
  urlsForHost,
} from "../seo/indexnow-submit.mjs";

describe("parseSitemap", () => {
  it("reads <loc> values and unescapes &amp;", () => {
    const xml = `<urlset><url><loc>https://a.com/x?a=1&amp;b=2</loc></url><url><loc> https://a.com/y </loc></url></urlset>`;
    expect(parseSitemap(xml)).toEqual({
      isIndex: false,
      locs: ["https://a.com/x?a=1&b=2", "https://a.com/y"],
    });
  });

  it("recognises a sitemap index", () => {
    const xml = `<sitemapindex><sitemap><loc>https://a.com/s1.xml</loc></sitemap></sitemapindex>`;
    expect(parseSitemap(xml).isIndex).toBe(true);
  });
});

describe("urlsForHost", () => {
  it("keeps same-host page URLs only, once each", () => {
    const urls = urlsForHost("a.com", [
      "https://a.com/",
      "https://a.com/",
      "https://a.com/#pricing",
      "https://www.a.com/",
      "https://b.com/",
      "mailto:x@a.com",
      "not a url",
    ]);
    expect(urls).toEqual(["https://a.com/"]);
  });
});

describe("indexNowBody", () => {
  it("points keyLocation at the key file on the same host", () => {
    expect(indexNowBody("qron.space", ["https://qron.space/"])).toEqual({
      host: "qron.space",
      key: INDEXNOW_KEY,
      keyLocation: `https://qron.space/${INDEXNOW_KEY}.txt`,
      urlList: ["https://qron.space/"],
    });
  });

  it("covers the four brand domains", () => {
    expect(HOSTS).toEqual(["authichain.com", "qron.space", "strainchain.io", "govchain.us"]);
  });
});
