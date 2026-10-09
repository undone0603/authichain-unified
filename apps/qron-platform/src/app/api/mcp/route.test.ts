// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { transform } from "esbuild";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Zac-class (billing). The placeholder MCP tools return no result, so they must
// never report metered usage to Stripe (reportAgentUsage). PM-348 follow-up.
//
// The root vitest config sends "@/..." to client/src, so route.ts cannot be
// imported directly here. Instead the route source is transpiled with esbuild
// and its imports are swapped for stubs, so the real POST handler runs.

const ROUTE = path.join(__dirname, "route.ts");
const EXACT = "Not available yet: this tool returns no verification result.";

const PLACEHOLDER_CALLS: Array<[string, Record<string, unknown>]> = [
  ["authichain_verify_product", { serial: "SN-1" }],
  ["authichain_check_eu_dpp", { certification_id: "CERT-1" }],
  ["authichain_register_product", { name: "Boot", manufacturer: "Acme" }],
];

const reportAgentUsage = vi.fn(async () => undefined);
const stubs: Record<string, unknown> = {
  "next/server": {
    NextResponse: {
      json: (body: unknown, init?: { status?: number }) => ({
        status: init?.status ?? 200,
        body,
      }),
    },
  },
  "@/lib/auth-api": { verifyApiKey: async () => "user-123" },
  "@/lib/automation": { logAutomation: async () => undefined },
  "@/lib/industrial/billing": { reportAgentUsage, METERED_PRICING: {} },
};

type Res = { status: number; body: any };
let POST: (req: unknown) => Promise<Res>;

beforeAll(async () => {
  const src = readFileSync(ROUTE, "utf8");
  const { code } = await transform(src, {
    loader: "ts",
    format: "cjs",
    target: "es2022",
  });
  const mod = { exports: {} as Record<string, unknown> };
  const req = (id: string) => {
    if (!(id in stubs)) throw new Error(`unexpected import in route.ts: ${id}`);
    return stubs[id];
  };
  new Function("module", "exports", "require", code)(mod, mod.exports, req);
  POST = mod.exports.POST as typeof POST;
});

function call(name: string, args: Record<string, unknown>) {
  return POST({
    headers: { get: (h: string) => (h === "X-API-Key" ? "test-key" : null) },
    json: async () => ({ method: "tools/call", params: { name, arguments: args } }),
  });
}

describe("qron-platform /api/mcp placeholder tools are not billed", () => {
  beforeEach(() => reportAgentUsage.mockClear());

  it.each(PLACEHOLDER_CALLS)(
    "%s returns the placeholder and reports no usage",
    async (name, args) => {
      const res = await call(name, args);
      expect(res.status).toBe(200);
      expect(res.body.content[0].text).toBe(EXACT);
      await new Promise((r) => setTimeout(r, 0));
      expect(reportAgentUsage).not.toHaveBeenCalled();
    }
  );

  it("authichain_get_pricing lists no per-call price for the placeholder tools (PM-362)", async () => {
    const res = await call("authichain_get_pricing", {});
    expect(res.status).toBe(200);
    const text: string = res.body.content[0].text;
    const pricing = JSON.parse(text);
    for (const key of ["verify_product", "register_product", "check_eu_dpp"]) {
      expect(pricing).not.toHaveProperty(key);
    }
    expect(text).not.toMatch(/\$\d/);
    // Cut only: the remaining fields are unchanged.
    expect(Object.keys(pricing).sort()).toEqual(["contract", "network", "token"]);
    expect(pricing.network).toBe("Polygon POS");
  });

  it("route source does not import or call reportAgentUsage", () => {
    const src = readFileSync(ROUTE, "utf8");
    expect(src).not.toMatch(/import[^;]*reportAgentUsage/);
    expect(src).not.toMatch(/reportAgentUsage\s*\(/);
  });
});
