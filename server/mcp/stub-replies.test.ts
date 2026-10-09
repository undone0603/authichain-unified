import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { STUB_TOOL_NAMES, STUB_TOOL_REPLY, mcpServer } from "./index";

// PM-348 / ADM-114 / RES-106: the in-development MCP tools must return no
// verdict. Exact reply, no authenticity/blockchain/minting status, no origin
// or country-of-origin field, no confidence value.
const EXACT = "Not available yet: this tool returns no verification result.";

const BANNED = [
  /VERIFIED/i,
  /AUTHENTIC/i,
  /UNVERIFIED/i,
  /Blockchain status/i,
  /SECURED/i,
  /SEALED/i,
  /Minting/i,
  /initiated/i,
  /consensus/i,
  /Made in USA/i,
  /origin/i,
  /country/i,
  /Manufacturer/i,
  /confidence/i,
  /CLASSIFIED/i,
  /COMPLIANT/i,
];

const BANNED_KEYS = [
  "origin",
  "countryOfOrigin",
  "country_of_origin",
  "country",
  "confidence",
  "status",
  "verdict",
  "verified",
];

const ARGS: Record<
  (typeof STUB_TOOL_NAMES)[number],
  Record<string, unknown>
> = {
  verify_authenticity: { certificateNumber: "AC-2026-0001" },
  mint_certificate: { productId: 1, userId: 1 },
  classify_product: { name: "Leather boot", description: "Made in USA" },
  verify_sovereign_deal: { truemarkId: "TM-0001" },
};

let client: Client;

beforeAll(async () => {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await mcpServer.connect(serverTransport);
  client = new Client({ name: "stub-reply-test", version: "0.0.0" });
  await client.connect(clientTransport);
});

afterAll(async () => {
  await client?.close();
});

describe("MCP stub tools return no verdict (PM-348)", () => {
  it("uses the Research-passed wording", () => {
    expect(STUB_TOOL_REPLY).toBe(EXACT);
  });

  it("keeps the four tool names and their input schemas", async () => {
    const { tools } = await client.listTools();
    const byName = new Map(tools.map(t => [t.name, t]));
    for (const name of STUB_TOOL_NAMES) expect(byName.has(name)).toBe(true);
    expect(
      Object.keys(byName.get("verify_authenticity")!.inputSchema.properties!)
    ).toEqual(["certificateNumber"]);
    expect(
      Object.keys(byName.get("mint_certificate")!.inputSchema.properties!)
    ).toEqual(["productId", "userId", "bountyAmount"]);
    expect(
      Object.keys(byName.get("classify_product")!.inputSchema.properties!)
    ).toEqual(["name", "description"]);
    expect(
      Object.keys(byName.get("verify_sovereign_deal")!.inputSchema.properties!)
    ).toEqual(["truemarkId"]);
  });

  for (const name of STUB_TOOL_NAMES) {
    it(`${name} replies exactly and carries no verdict text or fields`, async () => {
      const res = await client.callTool({ name, arguments: ARGS[name] });
      expect(res.isError ?? false).toBe(false);
      expect(res.structuredContent).toBeUndefined();
      expect(res.content).toEqual([{ type: "text", text: EXACT }]);

      const raw = JSON.stringify(res);
      for (const re of BANNED) {
        expect(EXACT).not.toMatch(re);
        expect(raw).not.toMatch(re);
      }
      const keys = new Set<string>();
      const walk = (v: unknown) => {
        if (v && typeof v === "object") {
          for (const [k, child] of Object.entries(v)) {
            keys.add(k);
            walk(child);
          }
        }
      };
      walk(res);
      for (const k of BANNED_KEYS) expect(keys.has(k)).toBe(false);
    });
  }
});

describe("qron-platform /api/mcp stub replies (PM-348)", () => {
  const src = readFileSync(
    path.resolve(
      import.meta.dirname,
      "../../apps/qron-platform/src/app/api/mcp/route.ts"
    ),
    "utf8"
  );

  it("defines the exact Research-passed reply", () => {
    expect(src).toContain(`"${EXACT}"`);
    expect(src.match(/text: STUB_TOOL_REPLY/g)?.length).toBe(3);
  });

  it("no longer returns the old stub verdicts", () => {
    for (const old of [
      "Consensus nodes: 5/5",
      "Status: SECURED",
      "Status: COMPLIANT",
      "Lifecycle emissions: 2.4kg",
      "Circularity score: 8/10",
      "Certificate pending on-chain anchor",
      "Registration protocol activated",
    ]) {
      expect(src).not.toContain(old);
    }
  });
});
