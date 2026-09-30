import { describe, expect, it } from "vitest";
import { census, evaluate, regressions } from "../typecheck-ratchet.mjs";

const err = (file: string, code: number) =>
  `${file}(1,1): error TS${code}: something`;

describe("typecheck ratchet", () => {
  it("passes at or under the baseline and says when to lower it", () => {
    const out = [err("a.ts", 2345), err("b.ts", 2322)].join("\n");
    expect(evaluate(out, 2)).toMatchObject({ ok: true, count: 2 });
    const under = evaluate(out, 5);
    expect(under.ok).toBe(true);
    expect(under.reason).toMatch(/lower the baseline to 2/);
  });

  it("fails when errors go up", () => {
    const out = [err("a.ts", 2345), err("b.ts", 2322), err("c.ts", 7006)].join(
      "\n"
    );
    const r = evaluate(out, 2);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/\+1/);
  });

  it("always fails on a syntax error, whatever the count", () => {
    // tsc stops at a parse error, so the count collapses to 1 and would
    // otherwise look like a huge improvement. This is what #1208 did.
    const out = err("scripts/b2b-cold-outreach.ts", 1005);
    const r = evaluate(out, 342);
    expect(r.ok).toBe(false);
    expect(r.syntax).toHaveLength(1);
  });

  it("ignores lines that aren't errors", () => {
    expect(evaluate("Found 0 errors.\nsome warning", 0)).toMatchObject({
      ok: true,
      count: 0,
    });
  });

  it("doesn't count order-dependent TS2589, which flickers between runs", () => {
    const out = [err("a.ts", 2345), err("server/mcp/index.ts", 2589)].join(
      "\n"
    );
    expect(evaluate(out, 1)).toMatchObject({ ok: true, count: 1 });
  });

  it("fails closed when tsc crashes or is killed", () => {
    // tsconfig.worker.json needs about 5 GB; an out-of-memory crash prints no
    // "error TS" lines and would otherwise read as zero errors.
    expect(evaluate("FATAL ERROR: Reached heap limit", 754, 134)).toMatchObject(
      { ok: false }
    );
    expect(evaluate("", 754, null)).toMatchObject({ ok: false });
    expect(evaluate("", 0, 0)).toMatchObject({ ok: true, count: 0 });
  });
});

describe("census", () => {
  it("counts errors per file and code, ignoring line and message", () => {
    const out = [
      "a.ts(1,1): error TS2345: one",
      "a.ts(99,4): error TS2345: a different message entirely",
      "b.ts(1,1): error TS2322: other",
    ].join("\n");
    expect(census(out)).toEqual({ "a.ts|TS2345": 2, "b.ts|TS2322": 1 });
  });

  it("leaves out order-dependent TS2589, like the count does", () => {
    const out = [err("a.ts", 2345), err("a.ts", 2589)].join("\n");
    expect(census(out)).toEqual({ "a.ts|TS2345": 1 });
  });

  it("ignores lines that aren't errors", () => {
    expect(census("Found 3 errors.\n\nsome warning")).toEqual({});
  });
});

describe("regressions", () => {
  const before = { "a.ts|TS2345": 2, "b.ts|TS2322": 1 };

  it("names a brand-new file/code pair", () => {
    const after = { ...before, "c.ts|TS7006": 1 };
    expect(regressions(before, after)).toEqual([
      { key: "c.ts|TS7006", was: 0, now: 1 },
    ]);
  });

  it("names a pair that got worse, with both counts", () => {
    expect(regressions(before, { ...before, "a.ts|TS2345": 5 })).toEqual([
      { key: "a.ts|TS2345", was: 2, now: 5 },
    ]);
  });

  it("stays quiet when a pair is fixed or unchanged", () => {
    expect(regressions(before, { "a.ts|TS2345": 1 })).toEqual([]);
  });

  it("treats everything as new when nothing was recorded", () => {
    expect(regressions(undefined, { "a.ts|TS2345": 1 })).toEqual([
      { key: "a.ts|TS2345", was: 0, now: 1 },
    ]);
  });

  it("separates a net-zero swap that a count alone would hide", () => {
    // Two new, two fixed: the total is unchanged, so only a census diff
    // shows that anything happened at all.
    const after = { "a.ts|TS2345": 2, "d.ts|TS2571": 1 };
    expect(regressions(before, after)).toEqual([
      { key: "d.ts|TS2571", was: 0, now: 1 },
    ]);
  });
});
