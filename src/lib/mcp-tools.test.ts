import { describe, expect, it, vi } from "vitest";
import {
  MCP_TOOLS,
  REGISTER_NOT_AVAILABLE,
  runMeteredMcpTool,
} from "./mcp-tools";

const SEAL_ID = "3f2b8c1e-9a4d-4c2b-8e1f-0a1b2c3d4e5f";

function fakeSupabase(rows: {
  auth_seals?: Record<string, unknown> | null;
  products?: Record<string, unknown> | null;
  error?: { message: string };
}) {
  const from = vi.fn((table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({
        data: (rows as Record<string, unknown>)[table] ?? null,
        error: rows.error ?? null,
      }),
    };
    return chain;
  });
  return { from };
}

function textOf(outcome: Awaited<ReturnType<typeof runMeteredMcpTool>>) {
  return outcome?.result.content[0].text ?? "";
}

describe("runMeteredMcpTool: authichain_verify_product", () => {
  it("answers from the registry and meters a found seal", async () => {
    const db = fakeSupabase({
      auth_seals: { id: SEAL_ID, product_id: "p1", brand: "Acme" },
    });
    const out = await runMeteredMcpTool(
      "authichain_verify_product",
      { seal_id: SEAL_ID },
      db
    );
    expect(out?.meter).toBe("verify_product");
    expect(out?.result.isError).toBeUndefined();
    const body = JSON.parse(textOf(out));
    expect(body.registered).toBe(true);
    expect(body.checks.signature).toBe("not_checked");
    expect(db.from).toHaveBeenCalledWith("auth_seals");
  });

  it("meters a not-registered answer too: it is a real answer", async () => {
    const out = await runMeteredMcpTool(
      "authichain_verify_product",
      { seal_id: SEAL_ID },
      fakeSupabase({ auth_seals: null })
    );
    expect(out?.meter).toBe("verify_product");
    expect(JSON.parse(textOf(out)).status).toBe("not_registered");
  });

  it("refuses a serial without a lookup, unmetered", async () => {
    const db = fakeSupabase({});
    const out = await runMeteredMcpTool(
      "authichain_verify_product",
      { serial: "SN-1" },
      db
    );
    expect(out?.meter).toBeNull();
    expect(out?.result.isError).toBe(true);
    expect(textOf(out)).toContain("seal_id_required");
    expect(db.from).not.toHaveBeenCalled();
  });

  it("does not meter a registry outage", async () => {
    const out = await runMeteredMcpTool(
      "authichain_verify_product",
      { seal_id: SEAL_ID },
      fakeSupabase({ error: { message: "down" } })
    );
    expect(out?.meter).toBeNull();
    expect(out?.result.isError).toBe(true);
    expect(textOf(out)).toContain("registry_unavailable");
  });
});

describe("runMeteredMcpTool: authichain_check_eu_dpp", () => {
  it("verifies a published passport and meters it", async () => {
    const out = await runMeteredMcpTool(
      "authichain_check_eu_dpp",
      { dpp_id: "p1" },
      fakeSupabase({
        products: {
          id: "p1",
          name: "Cell",
          brand: "Acme",
          status: "published",
          metadata: { dpp: true },
        },
      })
    );
    expect(out?.meter).toBe("check_eu_dpp");
    expect(out?.result.isError).toBeUndefined();
    const body = JSON.parse(textOf(out));
    expect(body.status).toBe("verified");
    expect(body.doesNotProve).toBeTruthy();
  });

  it("answers not_found for an unpublished id, metered, not an error", async () => {
    const out = await runMeteredMcpTool(
      "authichain_check_eu_dpp",
      { certification_id: "p2" },
      fakeSupabase({ products: { id: "p2", status: "draft", metadata: {} } })
    );
    expect(out?.meter).toBe("check_eu_dpp");
    expect(out?.result.isError).toBeUndefined();
    expect(JSON.parse(textOf(out)).error).toBe("not_found");
  });

  it("does not meter a missing id", async () => {
    const out = await runMeteredMcpTool(
      "authichain_check_eu_dpp",
      {},
      fakeSupabase({})
    );
    expect(out?.meter).toBeNull();
    expect(out?.result.isError).toBe(true);
  });
});

describe("runMeteredMcpTool: other tools", () => {
  it("says registration is not available, unmetered", async () => {
    const out = await runMeteredMcpTool(
      "authichain_register_product",
      { name: "x", manufacturer: "y", target_url: "https://e.x" },
      fakeSupabase({})
    );
    expect(out?.meter).toBeNull();
    expect(out?.result.isError).toBe(true);
    expect(textOf(out)).toBe(REGISTER_NOT_AVAILABLE);
  });

  it("returns null for a tool it does not own", async () => {
    expect(
      await runMeteredMcpTool("authichain_get_pricing", {}, fakeSupabase({}))
    ).toBeNull();
  });

  it("advertises no fixed verdicts", () => {
    const listed = JSON.stringify(MCP_TOOLS);
    expect(listed).not.toMatch(/consensus|mints a corresponding NFT/i);
  });
});
