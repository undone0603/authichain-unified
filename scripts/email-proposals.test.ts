// @vitest-environment node
import { describe, expect, it } from "vitest";
import { digestHtml } from "./email-proposals";

describe("government opportunity digest", () => {
  it("lists solicitations for the owner and says nothing went to an agency", () => {
    const html = digestHtml([
      {
        notice_id: "abc123",
        title: "Supply chain <traceability>",
        agency: "DLA",
        fit_score: 82,
        deadline: null,
        contact_email: "officer@dla.mil",
      },
    ]);
    expect(html).toContain("https://sam.gov/opp/abc123/view");
    expect(html).toContain("Supply chain &lt;traceability&gt;");
    expect(html).toContain("Nothing was emailed to any agency");
    expect(html).toContain("our internal score");
    // The agency contact is not something the digest acts on.
    expect(html).not.toContain("officer@dla.mil");
  });
});
