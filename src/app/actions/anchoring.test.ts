/**
 * P1 containment: QRON on-chain anchoring is off. The server action must
 * refuse every write without touching the chain or the database, and the
 * dashboard page must render a disabled control with the plain notice.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const anchorEdgeHash = vi.fn();
const createClient = vi.fn();

vi.mock("@/lib/blockchain", () => ({ anchorEdgeHash }));
vi.mock("@/utils/supabase/server", () => ({ createClient }));
vi.mock("@/lib/automation", () => ({ logAutomation: vi.fn(), formatErr: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ROOT = path.resolve(import.meta.dirname, "../../..");
const NOTICE = "On-chain anchoring is not available yet";

describe("anchorQRONAction (contained)", () => {
  beforeEach(() => {
    anchorEdgeHash.mockReset();
    createClient.mockReset();
  });

  it("refuses the write and never calls the chain or the database", async () => {
    const { anchorQRONAction } = await import("./anchoring");
    const result = await anchorQRONAction("qron-123", "0x" + "ab".repeat(32));
    expect(result).toEqual({ success: false, error: NOTICE });
    expect(anchorEdgeHash).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("the qron-platform copy refuses the write too", async () => {
    const mod = await import("../../../apps/qron-platform/src/app/actions/anchoring");
    expect(await mod.anchorQRONAction("qron-123", "x")).toEqual({ success: false, error: NOTICE });
    expect(anchorEdgeHash).not.toHaveBeenCalled();
  });
});

describe("QRON dashboard page anchoring control", () => {
  for (const rel of [
    "src/app/dashboard/qron/[id]/page.tsx",
    "apps/qron-platform/src/app/dashboard/qron/[id]/page.tsx",
  ]) {
    it(`${rel} renders a disabled control with the plain notice`, () => {
      const src = readFileSync(path.join(ROOT, rel), "utf8");
      const button = src.match(/<button[^>]*data-testid="anchor-disabled"[\s\S]*?<\/button>/)?.[0] ?? "";
      expect(button).toMatch(/\bdisabled\b/);
      expect(button).toContain("{ANCHORING_UNAVAILABLE}");
      expect(button).not.toMatch(/onClick/);
      expect(src).not.toMatch(/anchorQRONAction|ethers\.id|Ed25519|Anchor to Polygon/);
    });
  }

  it("the notice text is the plain line", async () => {
    const a = await import("@/lib/anchoring-status");
    const b = await import("../../../apps/qron-platform/src/lib/anchoring-status");
    expect(a.ANCHORING_UNAVAILABLE).toBe(NOTICE);
    expect(b.ANCHORING_UNAVAILABLE).toBe(NOTICE);
  });
});
