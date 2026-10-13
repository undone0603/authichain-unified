import { describe, expect, it } from "vitest";
import {
  renderAgentPresentation,
  tryHandleAgentPresentation,
} from "./agent-present-page";

const NOW = new Date("2026-10-13T19:00:00.000Z");

describe("GET /agent/agentz", () => {
  it("shows the signed offer when the signature, permission, and expiry hold", async () => {
    const rendered = await renderAgentPresentation({ now: NOW });
    expect(rendered.valid).toBe(true);
    expect(rendered.html).toContain("This message checks out");
    expect(rendered.html).toContain("I am AgentZ");
    expect(rendered.html).toContain("PRESENT_ONE_OFFER");
    expect(rendered.html).toContain("Ride Aventon Germany GmbH");
    expect(rendered.html).toContain("call the draft a battery passport");
    expect(rendered.html).toContain("The reader has not accepted this");
    expect(rendered.html).not.toContain("registered battery passport");
  });

  it("fails closed when the signature is altered and does not show the offer as authorized", async () => {
    const intact = await renderAgentPresentation({ now: NOW });
    expect(intact.valid).toBe(true);
    const broken = await renderAgentPresentation({
      now: NOW,
      message: {
        ...(await messageFromIntact()),
        signature: "not-a-signature",
      },
    });
    expect(broken.valid).toBe(false);
    expect(broken.html).toContain("This message does not check out");
    expect(broken.html).toContain("Nothing in it is authorized");
    expect(broken.html).not.toContain("I am AgentZ");
    expect(broken.body.reasons).toEqual(
      expect.arrayContaining(["SIGNATURE_INVALID"])
    );
  });

  it("serves the page and a JSON check on the public path", async () => {
    const html = await tryHandleAgentPresentation(
      new Request("https://authichain.com/agent/agentz")
    );
    expect(html).not.toBeNull();
    expect(html!.status).toBe(200);
    expect(html!.headers.get("content-type")).toMatch(/text\/html/);
    expect(await html!.text()).toContain("This message checks out");

    const json = await tryHandleAgentPresentation(
      new Request("https://authichain.com/agent/agentz?format=json")
    );
    const body = await json!.json();
    expect(body.valid).toBe(true);
    expect(body.capabilities).toEqual(["PRESENT_ONE_OFFER"]);
    expect(body.intent).toBe("present_one_draft");
  });
});

async function messageFromIntact() {
  const { AGENTZ_PRESENTATION } = await import("./agentz-presentation");
  return {
    ...AGENTZ_PRESENTATION.message,
    protocol: "authichain-agent/1" as const,
    capabilities: [...AGENTZ_PRESENTATION.message.capabilities],
    evidence_ids: [...AGENTZ_PRESENTATION.message.evidence_ids],
    payload: { ...AGENTZ_PRESENTATION.message.payload },
  };
}
