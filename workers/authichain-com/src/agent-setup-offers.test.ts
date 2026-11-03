import { describe, expect, it } from "vitest";
import {
  A2A_AGENT_CARD_URL,
  A2A_JSONRPC_ENDPOINT,
  AGENT_SETUP_OFFERS,
  MCP_REMOTE_ENDPOINT,
  agentConnectionDiscovery,
  renderAgentSetupOffers,
} from "./agent-setup-offers";

describe("MCP + A2A connection offers", () => {
  it("keeps free verification separate from quote-only operator setup", () => {
    expect(AGENT_SETUP_OFFERS.map(o => o.id)).toEqual([
      "mcp-self-connect",
      "mcp-assisted-setup",
      "a2a-peer-onboarding",
    ]);
    expect(AGENT_SETUP_OFFERS[0].billing).toBe("free");
    expect(AGENT_SETUP_OFFERS.slice(1).every(o => o.billing === "quote_only"))
      .toBe(true);
    const catalogue = agentConnectionDiscovery();
    expect(catalogue.status).toBe("public_discovery_only");
    expect(JSON.stringify(catalogue)).not.toContain("buy.stripe.com");
    expect(JSON.stringify(catalogue)).not.toContain("payment_intent");
    expect(JSON.stringify(catalogue)).not.toContain("secret");
  });

  it("lists the actual MCP and A2A 1.0 endpoints and no connection assertion", () => {
    const catalogue = agentConnectionDiscovery();
    expect(catalogue.mcp.endpoint).toBe(MCP_REMOTE_ENDPOINT);
    expect(catalogue.mcp.configuration.mcpServers.authichain.url).toBe(
      MCP_REMOTE_ENDPOINT
    );
    expect(catalogue.a2a.agentCard).toBe(A2A_AGENT_CARD_URL);
    expect(catalogue.a2a.endpoint).toBe(A2A_JSONRPC_ENDPOINT);
    expect(catalogue.a2a.version).toBe("1.0");
    expect(catalogue.a2a.taskMessagingAutomaticallyAuthorized).toBe(false);
    expect(catalogue.a2a.connectionRequiresPeerConsent).toBe(true);
  });

  it("renders setup tiers without prices or credential collection", () => {
    const html = renderAgentSetupOffers();
    expect(html).toContain('id="agent-connections"');
    expect(html).toContain("MCP &amp; A2A connections");
    expect(html).toContain("Assisted MCP integration");
    expect(html).toContain("A2A peer interoperability setup");
    expect(html).toContain("Written quote");
    expect(html).toContain(A2A_AGENT_CARD_URL);
    expect(html).toContain(MCP_REMOTE_ENDPOINT);
    expect(html).not.toContain("buy.stripe.com");
    expect(html).not.toContain("<form");
    expect(html).toContain("No payment is collected on this page");
  });
});
