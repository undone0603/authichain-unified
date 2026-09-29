import { describe, expect, it } from "vitest";
import { docsCtaClickEvent, docsViewEvent } from "./docs-events";

describe("docs funnel events", () => {
  it("counts a hub GET and ignores aliases", () => {
    expect(docsViewEvent("GET", "/docs")).toEqual({
      evt: "docs_hub_view",
      path: "/docs",
    });
    expect(docsViewEvent("GET", "/docs/")).toEqual({
      evt: "docs_hub_view",
      path: "/docs",
    });
    expect(docsViewEvent("HEAD", "/docs")).toBeNull();
    expect(docsViewEvent("GET", "/docs/protocol")).toBeNull();
    expect(docsViewEvent("GET", "/docs/x402")).toBeNull();
  });

  it("counts a wave-1 article GET", () => {
    expect(docsViewEvent("GET", "/docs/dpp-architecture")).toEqual({
      evt: "docs_article_view",
      path: "/docs/dpp-architecture",
      slug: "dpp-architecture",
    });
  });

  it("counts a docs-sourced money click and ignores other traffic", () => {
    const click = docsCtaClickEvent(
      "GET",
      new URL(
        "https://authichain.com/checkout/dpp_readiness?utm_source=docs&utm_medium=authority&utm_campaign=dpp-architecture"
      )
    );
    expect(click).toEqual({
      evt: "docs_cta_click",
      path: "/checkout/dpp_readiness",
      utm_source: "docs",
      utm_medium: "authority",
      utm_campaign: "dpp-architecture",
    });
    expect(
      docsCtaClickEvent(
        "GET",
        new URL("https://authichain.com/dpp-check?utm_source=docs&utm_campaign=docs-hub")
      )?.evt
    ).toBe("docs_cta_click");
    expect(
      docsCtaClickEvent("POST", new URL("https://authichain.com/checkout/dpp_readiness?utm_source=docs"))
    ).toBeNull();
    expect(
      docsCtaClickEvent("GET", new URL("https://authichain.com/checkout/dpp_readiness"))
    ).toBeNull();
    expect(
      docsCtaClickEvent("GET", new URL("https://authichain.com/pricing?utm_source=docs"))
    ).toBeNull();
  });
});
