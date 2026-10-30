import { describe, expect, it } from "vitest";
import {
  CLAUDE_CODE_COMMAND,
  CURSOR_DEEPLINK,
  MCP_ENDPOINT,
  PUBLISHED_PACKS,
  SHOWCASES,
  VSCODE_CLIENT_CONFIG,
  VSCODE_COMMAND,
  isMcpInstallPath,
  renderMcpInstallPage,
} from "./mcp-install-page";
import { TOOLS, isMcpPath } from "./mcp-routes";
import { DPP_CATEGORIES } from "../../../src/lib/dpp-readiness.ts";
import manifest from "../../../content/microsites/manifest.json" with { type: "json" };

describe("mcp install routing", () => {
  it("claims only the install paths and never the agent endpoint", () => {
    expect(isMcpInstallPath("/mcp/install")).toBe(true);
    expect(isMcpInstallPath("/mcp/install/")).toBe(true);
    expect(isMcpInstallPath("/mcp/app")).toBe(true);
    // The JSON-RPC endpoint must keep answering agents.
    expect(isMcpInstallPath("/mcp")).toBe(false);
    expect(isMcpInstallPath("/api/mcp")).toBe(false);
    expect(isMcpInstallPath("/.well-known/mcp.json")).toBe(false);
  });

  it("does not collide with isMcpPath in either direction", () => {
    for (const p of ["/mcp/install", "/mcp/app"]) {
      expect(isMcpPath(p), p).toBe(false);
    }
    for (const p of ["/mcp", "/api/mcp", "/.well-known/mcp.json"]) {
      expect(isMcpInstallPath(p), p).toBe(false);
    }
  });
});

describe("mcp install page", () => {
  const html = renderMcpInstallPage();

  it("renders a complete document with a canonical and a viewport", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<link rel="canonical"');
    expect(html).toContain("width=device-width");
    expect(html).toContain("</html>");
  });

  it("offers every install path a reader needs", () => {
    expect(html).toContain(MCP_ENDPOINT);
    expect(html).toContain("cursor://anysphere.cursor-deeplink/mcp/install");
    expect(html).toContain("code --add-mcp");
    expect(html).toContain("claude mcp add --transport http");
  });

  it("builds deeplinks that carry the real endpoint", () => {
    // Cursor takes base64 JSON; decode it rather than trusting the string.
    const config = new URL(
      CURSOR_DEEPLINK.replace("cursor://", "https://")
    ).searchParams.get("config");
    expect(config).toBeTruthy();
    expect(JSON.parse(atob(config!))).toEqual({ url: MCP_ENDPOINT });

    expect(CLAUDE_CODE_COMMAND.endsWith(MCP_ENDPOINT)).toBe(true);
  });

  /**
   * Both of these are vendor-documented mechanisms, not inferred ones.
   * Claude Code: `claude mcp add --transport http <name> <url>`.
   * VS Code: `code --add-mcp '<json>'`. There is deliberately no
   * vscode:mcp/install deeplink — see the note in mcp-install-page.ts.
   */
  it("ships a VS Code command carrying parseable JSON for the endpoint", () => {
    expect(VSCODE_COMMAND.startsWith("code --add-mcp ")).toBe(true);
    const json = VSCODE_COMMAND.slice("code --add-mcp ".length).replace(
      /^'|'$/g,
      ""
    );
    expect(JSON.parse(json)).toEqual({
      name: "authichain",
      type: "http",
      url: MCP_ENDPOINT,
    });
  });

  it("publishes VS Code's servers shape, not just mcpServers", () => {
    // VS Code ignores an mcpServers block, so shipping only that shape
    // would silently do nothing for those users.
    expect(VSCODE_CLIENT_CONFIG.servers.authichain.url).toBe(MCP_ENDPOINT);
    expect(html).toContain("&quot;servers&quot;");
    expect(html).toContain("&quot;mcpServers&quot;");
  });

  it("no longer offers an unverifiable vscode deeplink", () => {
    expect(html).not.toContain("vscode:mcp/install");
  });

  it("renders every live tool, so the page cannot drift from tools/list", () => {
    for (const tool of TOOLS) {
      expect(html, tool.name).toContain(`<code>${tool.name}</code>`);
    }
  });
});

describe("showcase seeding is honest", () => {
  it("only calls tools the server actually exposes", () => {
    const names = new Set(TOOLS.map(t => t.name));
    for (const s of SHOWCASES) {
      expect(names.has(s.call.tool), s.call.tool).toBe(true);
    }
  });

  it("states a limit on every showcase", () => {
    for (const s of SHOWCASES) {
      expect(s.limit.length, s.slug).toBeGreaterThan(20);
    }
  });

  it("uses a real DPP category id for the readiness showcase", () => {
    const dpp = SHOWCASES.find(s => s.call.tool === "dpp_readiness_check");
    expect(dpp).toBeTruthy();
    const ids = DPP_CATEGORIES.map(c => c.id);
    expect(ids).toContain(dpp!.call.args.category);
  });

  it("lists only packs that exist in the published microsite manifest", () => {
    const published = new Set(
      (manifest as { packs: { slug: string }[] }).packs.map(p => p.slug)
    );
    for (const pack of PUBLISHED_PACKS) {
      expect(published.has(pack.slug), pack.slug).toBe(true);
    }
  });

  /**
   * content/strainchain/{gtr-seeds,mendo-love-farms} are marked
   * "unlisted": true and hold transcribed customer CoAs. They must never
   * reach a public page, however convenient the extra showcase would be.
   */
  it("never surfaces the unlisted private grower packs", () => {
    const page = renderMcpInstallPage().toLowerCase();
    for (const secret of [
      "gtr-seeds",
      "gtr seeds",
      "mendo-love",
      "mendo love",
    ]) {
      expect(page.includes(secret), secret).toBe(false);
    }
  });
});
