import { describe, expect, it } from "vitest";
import {
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
