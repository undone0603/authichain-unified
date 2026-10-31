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
    expect(html).toContain("/battery-passport/sample-audit");
    expect(html).toContain("$299");
    expect(html).not.toMatch(/written plan/i);
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
    expect(html).toContain("Open a workspace");
    expect(html).not.toMatch(/written readiness plan/i);
    expect(html).not.toMatch(/written plan/i);
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

describe("/dpp-check email opt-in", () => {
  const inScope = () =>
    renderDppCheckPage(
      new URL(
        "https://authichain.com/dpp-check?category=battery_passport&sells_in_eu=yes&unique_id=yes"
      ),
      NOW
    );

  it("offers an opt-in form on an in-scope result, hidden until JavaScript runs", () => {
    const html = inScope();
    expect(html).toContain('id="result-optin"');
    expect(html).not.toContain("dpp-email-optin");
    // Without JS the form would end on the endpoint's raw JSON, so it ships hidden.
    expect(html).toMatch(/<form[^>]*id="result-optin"[^>]*\shidden>/);
    expect(html).toContain("/api/leads/capture");
  });

  it("requires an unchecked consent box that names the single follow-up", () => {
    const html = inScope();
    const box =
      /<input type="checkbox" name="consent" value="yes" required>/.exec(html);
    expect(box).not.toBeNull();
    expect(html).not.toMatch(/name="consent"[^>]*checked/);
    expect(html).toContain("one follow-up about the $299 workspace");
    expect(html).toContain("unsubscribe link");
  });

  it("stores the shape of the result, never anything typed", () => {
    const html = inScope();
    expect(html).toContain('name="source" value="dpp-check"');
    expect(html).toContain(
      'name="product_interest" value="dpp_check_followup"'
    );
    expect(html).toContain(
      'name="message" value="dpp-check:battery_passport:20:not_started"'
    );
    expect(html).toContain('name="categories" value="battery_passport"');
    expect(html).toContain('name="utm_campaign" value="dpp-check"');
  });

  it("does not describe the plan as an audit or a written plan", () => {
    const optIn = /<form[^>]*id="result-optin"[\s\S]*?<\/script>/.exec(
      inScope()
    );
    expect(optIn).not.toBeNull();
    expect(optIn![0]).not.toMatch(/audit|written plan/i);
  });

  it("is absent from the blank form and from a result with no EU duty", () => {
    const blank = renderDppCheckPage(
      new URL("https://authichain.com/dpp-check"),
      NOW
    );
    const noDuty = renderDppCheckPage(
      new URL("https://authichain.com/dpp-check?category=other&sells_in_eu=no"),
      NOW
    );
    expect(blank).not.toContain("result-optin");
    expect(blank).not.toContain("dpp-email-optin");
    expect(noDuty).not.toContain("result-optin");
    expect(noDuty).toContain('id="dpp-email-optin"');
  });

  it("no longer claims that nothing is stored", () => {
    const blank = renderDppCheckPage(
      new URL("https://authichain.com/dpp-check"),
      NOW
    );
    expect(blank).not.toContain("nothing stored");
    expect(blank).toContain(
      "Nothing is stored unless you ask for your result by email"
    );
  });
});
