// scripts/__tests__/estate-drift.test.ts
import { describe, expect, it } from "vitest";
import {
  decideIssueAction,
  evaluateDrift,
  loadEstate,
  repoWorkerNames,
  render,
  wranglerName,
} from "../autonomy/estate-drift.mjs";

const estate = {
  off_repo_workers: {
    "first-dollar-desk": { disposition: "archive" },
    "old-thing": { disposition: "retire" },
    "long-gone": { disposition: "retire" },
  },
};

describe("wranglerName", () => {
  it("reads the top-level name from toml, ignoring names inside tables", () => {
    expect(
      wranglerName('name = "qron-space"\nmain = "x.js"', "a/wrangler.toml")
    ).toBe("qron-space");
    expect(wranglerName("name = 'authichain'\n", "wrangler.toml")).toBe(
      "authichain"
    );
    expect(
      wranglerName(
        'main = "x"\n[[kv_namespaces]]\nname = "nope"\n',
        "wrangler.toml"
      )
    ).toBeNull();
  });
  it("reads json and jsonc", () => {
    expect(
      wranglerName(
        '{\n // c\n "name": "authichain-app"\n}',
        "wrangler.app.jsonc"
      )
    ).toBe("authichain-app");
  });
});

describe("evaluateDrift", () => {
  it("splits live Workers into ghosts, retire and tracked; lists gone entries", () => {
    const r = evaluateDrift(
      ["qron-space", "first-dollar-desk", "old-thing", "mystery"],
      new Set(["qron-space"]),
      estate
    );
    expect(r.ghosts).toEqual(["mystery"]);
    expect(r.retire).toEqual(["old-thing"]);
    expect(r.tracked).toEqual([
      { name: "first-dollar-desk", disposition: "archive" },
    ]);
    expect(r.gone).toEqual(["long-gone"]);
    expect(render(r, "t")).toMatch(/mystery/);
  });
});

describe("decideIssueAction", () => {
  const clean = { ghosts: [], retire: [], tracked: [], gone: [], live: 1 };
  const dirty = { ...clean, ghosts: ["mystery"] };
  it("stays silent when clean and no issue is open", () => {
    expect(decideIssueAction(null, clean, "t")).toEqual({ action: "none" });
  });
  it("opens once, does not re-post the same ghosts, and closes when clean", () => {
    const first = decideIssueAction(null, dirty, "t");
    expect(first.action).toBe("create");
    expect(
      decideIssueAction({ number: 1, body: first.body }, dirty, "t2").action
    ).toBe("none");
    expect(
      decideIssueAction({ number: 1, body: first.body }, clean, "t3").action
    ).toBe("close");
  });
});

describe("repo inventory", () => {
  it("every off-repo inventory entry is really off-repo (no wrangler config here)", () => {
    const names = repoWorkerNames();
    const inv = Object.keys(loadEstate().off_repo_workers);
    expect(inv.filter(n => names.has(n))).toEqual([]);
  });
  it("finds the app Worker and the edge router", () => {
    const names = repoWorkerNames();
    expect(names.has("authichain-app")).toBe(true);
    expect(names.has("authichain-edge-router")).toBe(true);
  });
});
