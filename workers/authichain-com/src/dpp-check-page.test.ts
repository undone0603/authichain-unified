import { describe, expect, it } from "vitest";
import {
  dppCheckCompleteEvent,
  dppCheckoutClickEvent,
  isDppCheckPath,
  renderDppCheckPage,
  tryHandleDppCheck,
} from "./dpp-check-page";

const NOW = new Date("2026-09-27T00:00:00Z");

describe("/dpp-check", () => {
  it("matches only its own path", () => {
    expect(isDppCheckPath("/dpp-check")).toBe(true);
    expect(isDppCheckPath("/dpp-check/")).toBe(true);
    expect(isDppCheckPath("/dpp")).toBe(false);
  });

  it("blank form is indexable and shows no result", () => {
    const html = renderDppCheckPage(
      new URL("https://authichain.com/dpp-check"),
      NOW
    );
    expect(html).toContain('name="category"');
    expect(html).toContain("index, follow");
    expect(html).not.toContain('id="result"');
    expect(html).not.toContain("checkout/dpp_readiness");
  });

  it("in-scope battery result shows countdown, gaps and the $299 checkout", () => {
    const html = renderDppCheckPage(
      new URL(
        "https://authichain.com/dpp-check?category=battery_passport&sells_in_eu=yes&unique_id=yes"
      ),
      NOW
    );
    expect(html).toContain("noindex, follow");
    expect(html).toContain("20/100");
    expect(html).toContain("<strong>144</strong> days");
    expect(html).toContain(
      'action="https://authichain.com/checkout/dpp_readiness"'
    );
    expect(html).toContain('name="utm_campaign" value="dpp-check"');
    expect(html).toContain('name="utm_content" value="battery_passport"');
    expect(html).toContain("Not legal advice");
  });

  it("no checkout when there is no EU duty", () => {
    const html = renderDppCheckPage(
      new URL(
        "https://authichain.com/dpp-check?category=other&sells_in_eu=yes"
      ),
      NOW
    );
    expect(html).toContain('id="result"');
    expect(html).not.toContain("checkout/dpp_readiness");
  });

  it("escapes reflected input", () => {
    const html = renderDppCheckPage(
      new URL("https://authichain.com/dpp-check?category=%3Cscript%3E"),
      NOW
    );
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain('id="result"');
  });

  it("handler ignores POST and other paths", () => {
    expect(
      tryHandleDppCheck(
        new Request("https://authichain.com/dpp-check", { method: "POST" })
      )
    ).toBeNull();
    expect(
      tryHandleDppCheck(new Request("https://authichain.com/pricing"))
    ).toBeNull();
    const res = tryHandleDppCheck(
      new Request("https://authichain.com/dpp-check?category=textiles")
    );
    expect(res?.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

describe("/dpp-check funnel events", () => {
  it("logs a completed check without free text", () => {
    const e = dppCheckCompleteEvent(
      new URL(
        "https://authichain.com/dpp-check?category=battery_passport&sells_in_eu=yes&unique_id=yes&utm_source=email&utm_campaign=battery-outreach&email=a@b.com"
      ),
      NOW
    );
    expect(e).toMatchObject({
      evt: "dpp_check_complete",
      category: "battery_passport",
      sells_in_eu: true,
      in_scope: true,
      utm_source: "email",
      utm_campaign: "battery-outreach",
    });
    expect(typeof e?.score).toBe("number");
    expect(JSON.stringify(e)).not.toContain("a@b.com");
  });

  it("ignores the blank form and other paths", () => {
    expect(
      dppCheckCompleteEvent(new URL("https://authichain.com/dpp-check"), NOW)
    ).toBeNull();
    expect(
      dppCheckCompleteEvent(
        new URL("https://authichain.com/pricing?category=battery_passport"),
        NOW
      )
    ).toBeNull();
  });

  const post = (path: string, fields: Record<string, string>) =>
    new Request(`https://authichain.com${path}`, {
      method: "POST",
      body: new URLSearchParams(fields),
    });

  it("marks checkout clicks from the checker and leaves the body readable", async () => {
    const req = post("/checkout/dpp_readiness", {
      email: "buyer@brand.eu",
      utm_source: "site",
      utm_medium: "free-tool",
      utm_campaign: "dpp-check",
      utm_content: "battery_passport",
    });
    const e = await dppCheckoutClickEvent(req);
    expect(e).toEqual({
      evt: "dpp_checkout_click",
      from_dpp_check: true,
      utm_source: "site",
      utm_medium: "free-tool",
      utm_campaign: "dpp-check",
      utm_content: "battery_passport",
    });
    expect(JSON.stringify(e)).not.toContain("buyer@brand.eu");
    expect((await req.formData()).get("email")).toBe("buyer@brand.eu");
  });

  it("counts other DPP checkout posts but not other plans or GETs", async () => {
    expect(
      await dppCheckoutClickEvent(post("/checkout/dpp", { email: "x@y.eu" }))
    ).toEqual({ evt: "dpp_checkout_click", from_dpp_check: false });
    expect(
      await dppCheckoutClickEvent(
        post("/checkout/starter", { email: "x@y.eu" })
      )
    ).toBeNull();
    expect(
      await dppCheckoutClickEvent(
        new Request("https://authichain.com/checkout/dpp_readiness")
      )
    ).toBeNull();
  });
});
