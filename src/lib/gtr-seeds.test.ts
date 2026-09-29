import { afterEach, describe, expect, it } from "vitest";
import {
  MIN_UNLISTED_TOKEN_LENGTH,
  UNLISTED_CACHE_CONTROL,
  UNLISTED_PREVIEW_ENV,
  UNLISTED_ROBOTS_TAG,
  UNLISTED_TOKEN_ENV,
  farmIsUnlisted,
  getCultivar,
  getDossier,
  listFarms,
  timeline,
  unlistedAccessGranted,
} from "./genetics";

const PREVIEW = { env: { [UNLISTED_PREVIEW_ENV]: "1" } };
const TOKEN = "gtr-review-token-16";
const GATED = {
  token: TOKEN,
  env: { [UNLISTED_TOKEN_ENV]: TOKEN },
};

afterEach(() => {
  delete process.env[UNLISTED_PREVIEW_ENV];
  delete process.env[UNLISTED_TOKEN_ENV];
});

describe("unlisted genetics stay private", () => {
  it("omits unlisted farms from the public index", () => {
    expect(listFarms()).toContain("mendo-love-farms");
    expect(listFarms()).not.toContain("gtr-seeds");
    expect(farmIsUnlisted("gtr-seeds")).toBe(true);
    expect(farmIsUnlisted("mendo-love-farms")).toBe(false);
  });

  it("rejects unlisted farm data with no gate", () => {
    expect(getDossier("gtr-seeds")).toBeNull();
    expect(getCultivar("gtr-seeds", "double-durban-thcv")).toBeNull();
    expect(timeline("gtr-seeds")).toEqual([]);
    expect(unlistedAccessGranted()).toBe(false);
    expect(unlistedAccessGranted({ token: TOKEN })).toBe(false);
  });

  it("opens the dossier only for the preview env or a long matching token", () => {
    const preview = getDossier("gtr-seeds", PREVIEW);
    expect(preview).not.toBeNull();
    expect(preview!.unlisted).toBe(true);
    expect(preview!.farm.name).toBe("GTR Seeds");

    process.env[UNLISTED_PREVIEW_ENV] = "1";
    expect(getDossier("gtr-seeds")).not.toBeNull();
    delete process.env[UNLISTED_PREVIEW_ENV];

    expect(getDossier("gtr-seeds", GATED)?.certificates).toHaveLength(2);
    expect(
      getDossier("gtr-seeds", {
        token: "short",
        env: { [UNLISTED_TOKEN_ENV]: "short" },
      })
    ).toBeNull();
    expect(
      getDossier("gtr-seeds", {
        token: "wrong-token-value!!",
        env: { [UNLISTED_TOKEN_ENV]: TOKEN },
      })
    ).toBeNull();
    expect(TOKEN.length).toBeGreaterThanOrEqual(MIN_UNLISTED_TOKEN_LENGTH);
  });

  it("does not invent a 10% THCV total from the seed CoAs", () => {
    const d = getDossier("gtr-seeds", PREVIEW)!;
    const doubleDurban = d.certificates.find(c => c.coa_id === "C231203-41")!;
    const garlic = d.certificates.find(c => c.coa_id === "C231203-42")!;

    expect(doubleDurban.derived.totalThcvPct).toBeNull();
    expect(doubleDurban.derived.totalThcPct).toBeNull();
    expect(doubleDurban.cannabinoids_pct).toBeNull();

    expect(garlic.derived.totalThcvPct).toBeNull();
    expect(garlic.derived.totalThcPct).toBe(3.374);
    expect(garlic.derived.mismatch).toBeNull();
    expect(garlic.cannabinoids_pct?.d8_THC).toBe(0.563);
    expect(garlic.cannabinoids_pct).not.toHaveProperty("THCV");

    const view = getCultivar("gtr-seeds", "garlic-berry-thcv", PREVIEW)!;
    expect(view.peakThcvPct).toBeNull();
    expect(view.certificates).toHaveLength(1);
  });

  it("keeps the public Mendo dossier on the one-argument call", () => {
    const d = getDossier("mendo-love-farms");
    expect(d).not.toBeNull();
    expect(d!.unlisted).toBe(false);
    expect(d!.certificates).toHaveLength(12);
  });

  it("pins the private response headers", () => {
    expect(UNLISTED_CACHE_CONTROL).toBe("private, no-store, max-age=0");
    expect(UNLISTED_ROBOTS_TAG).toBe("noindex, nofollow");
  });
});
