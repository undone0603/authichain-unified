import { describe, expect, it } from "vitest";
import { evaluate } from "../typecheck-ratchet.mjs";

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
