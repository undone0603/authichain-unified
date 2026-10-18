import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { acceptCoaUpload, COA_MAX_BYTES, hashCoaBytes } from "./coa-upload";

describe("acceptCoaUpload", () => {
  it("returns only the sha256 of a pdf and drops the bytes", () => {
    const bytes = Buffer.from("%PDF-1.4\nsecret-coa");
    const expected = "sha256:" + createHash("sha256").update(bytes).digest("hex");
    expect(hashCoaBytes(bytes)).toBe(expected);
    const result = acceptCoaUpload({ contentType: "application/pdf", bytes });
    bytes.fill(0);
    expect(result).toEqual({ status: 200, body: { coaSha256: expected } });
    expect(JSON.stringify(result)).not.toContain("secret-coa");
    expect(Object.keys(result.body)).toEqual(["coaSha256"]);
    const typed = acceptCoaUpload({ contentType: "application/pdf; charset=binary", bytes: Buffer.from("%PDF") });
    expect(typed.status).toBe(200);
  });

  it("refuses a JSON hash and an oversized pdf", () => {
    const supplied = "sha256:" + "ab".repeat(32);
    const json = acceptCoaUpload({
      contentType: "application/json",
      bytes: Buffer.from(JSON.stringify({ coaSha256: supplied })),
    });
    expect(json).toEqual({ status: 400, body: { error: "coa_bytes_required" } });
    const field = acceptCoaUpload({
      contentType: "application/json",
      bytes: { coaSha256: supplied },
    });
    expect(field.status).toBe(400);
    expect(field.body).toEqual({ error: "coa_bytes_required" });
    expect(acceptCoaUpload({ contentType: "application/pdf", bytes: new Uint8Array() }).status).toBe(400);
    const over = acceptCoaUpload({
      contentType: "application/pdf",
      bytes: new Uint8Array(COA_MAX_BYTES + 1),
    });
    expect(over).toEqual({ status: 413, body: { error: "coa_too_large" } });
    const capped = acceptCoaUpload({
      contentType: "application/pdf",
      bytes: new Uint8Array(COA_MAX_BYTES),
    });
    expect(capped.status).toBe(200);
    if (capped.status === 200) expect(capped.body.coaSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("mounts the upload and does not change checkout or the passport price", () => {
    const here = import.meta.dirname;
    const internal = readFileSync(path.join(here, "internal-api.ts"), "utf8");
    expect(internal).toContain("mountCoaUpload(router)");
    expect(internal).not.toMatch(/checkout-gate|plans\.ts/);
    const upload = readFileSync(path.join(here, "coa-upload.ts"), "utf8");
    expect(upload).toContain('"/passports/coa"');
    expect(upload).not.toMatch(/thcPercent|cbdPercent|metrc|delivered/i);
    const plans = readFileSync(path.join(here, "../src/lib/plans.ts"), "utf8");
    expect(plans).toContain('id: "strainchain_passport"');
    expect(plans).toContain("price: 49");
  });
});
