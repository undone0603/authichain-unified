import { describe, it, expect } from "vitest";
import { fingerprintCultivar } from "./fingerprint";
import { getCultivar } from "./genetics";

const farm = "mendo-love-farms";
const vt26 = () => getCultivar(farm, "vt-26")!;

describe("fingerprintCultivar", () => {
  it("produces the digest format the attestation validator accepts", () => {
    expect(fingerprintCultivar(vt26(), farm).digest).toMatch(
      /^sha256:[A-Fa-f0-9]{64}$/
    );
  });

  it("is deterministic across calls", () => {
    expect(fingerprintCultivar(vt26(), farm).digest).toBe(
      fingerprintCultivar(vt26(), farm).digest
    );
  });

  it("does not depend on the order certificates arrive in", () => {
    const a = vt26();
    const b = { ...vt26(), certificates: [...vt26().certificates].reverse() };
    expect(fingerprintCultivar(b, farm).digest).toBe(
      fingerprintCultivar(a, farm).digest
    );
  });

  it("changes when a covered figure changes", () => {
    const base = vt26();
    const tampered = {
      ...base,
      certificates: base.certificates.map((c, i) =>
        i === 0 && c.cannabinoids_pct
          ? { ...c, cannabinoids_pct: { ...c.cannabinoids_pct, THCVA: 99 } }
          : c
      ),
    };
    expect(fingerprintCultivar(tampered, farm).digest).not.toBe(
      fingerprintCultivar(base, farm).digest
    );
  });

  it("changes when only the provenance of a lineage claim changes", () => {
    // The point of carrying provenance into the hash: a record asserting
    // confirmed parentage is a different record from one asserting a guess,
    // even with identical parents.
    // LT-35, not VT-26: VT-26's own parent edge is already `claimed`, so
    // "downgrading" it would be a no-op and the test would pass vacuously.
    const base = getCultivar(farm, "lt-35")!;
    expect(base.parentEdges[0].provenance).toBe("confirmed_in_writing");
    const downgraded = {
      ...base,
      parentEdges: base.parentEdges.map(e => ({
        ...e,
        provenance: "claimed" as const,
      })),
    };
    expect(fingerprintCultivar(downgraded, farm).digest).not.toBe(
      fingerprintCultivar(base, farm).digest
    );
  });

  it("distinguishes two cultivars", () => {
    expect(fingerprintCultivar(vt26(), farm).digest).not.toBe(
      fingerprintCultivar(getCultivar(farm, "lt-35")!, farm).digest
    );
  });

  it("fingerprints a cultivar with no certificates at all", () => {
    // LT-63 is the one offered for licensing and has no chemistry on file.
    // It must still produce a record, and that record must say so.
    const fp = fingerprintCultivar(getCultivar(farm, "lt-63")!, farm);
    expect(fp.digest).toMatch(/^sha256:[A-Fa-f0-9]{64}$/);
    expect(fp.covers.join(" ")).toContain("0 certificates");
  });

  it("never claims to be anchored, and says so in the copy", () => {
    const fp = fingerprintCultivar(vt26(), farm);
    expect(fp.anchored).toBe(false);
    expect(fp.doesNotProve).toMatch(/timestamp|when this record existed/i);
  });

  it("publishes the exact bytes hashed so a third party can recompute", async () => {
    const fp = fingerprintCultivar(vt26(), farm);
    const { createHash } = await import("node:crypto");
    const recomputed = createHash("sha256")
      .update(fp.canonical, "utf8")
      .digest("hex");
    expect(`sha256:${recomputed}`).toBe(fp.digest);
  });
});
