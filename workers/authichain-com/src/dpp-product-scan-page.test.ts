import { describe, it, expect } from "vitest";
import { tryHandleDppCheck } from "./dpp-check-page.ts";

const NEW_LINK = "https://buy.stripe.com/6oU14n87n8Jo5iabDC1NE02";

async function get(path: string) {
  const res = tryHandleDppCheck(new Request(`https://authichain.com${path}`));
  expect(res).not.toBeNull();
  return { res: res!, html: await res!.text() };
}

describe("/dpp-check/product", () => {
  it("renders the blank form with 200 and no result", async () => {
    const { res, html } = await get("/dpp-check/product");
    expect(res.status).toBe(200);
    expect(html).toContain('action="/dpp-check/product"');
    expect(html).not.toContain('id="result"');
  });

  it("renders gaps for a shareable result URL, uncached", async () => {
    const { res, html } = await get("/dpp-check/product?category=textiles&gtin=4006381333932&materials=cotton");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(html).toContain("Data score:");
    expect(html).toContain("check digit");
    expect(html).toContain(NEW_LINK);
  });

  it("escapes user input", async () => {
    const { html } = await get("/dpp-check/product?category=toys&name=%3Cscript%3Ex");
    expect(html).not.toContain("<script>x");
  });

  it("never shows the retired link or price, and makes no conformity claim", async () => {
    const { html } = await get("/dpp-check/product?category=textiles");
    expect(html).not.toContain("eVqeVd1IZf7MeSKbDC1ND3x");
    expect(html).not.toContain("price_1UHlnq");
    expect(html).not.toMatch(/\bcompliant\b|\bcertified\b/i);
  });

  it("leaves /dpp-check itself unchanged", async () => {
    const { html } = await get("/dpp-check");
    expect(html).toContain("Map your EU DPP gaps. Free.");
  });
});
