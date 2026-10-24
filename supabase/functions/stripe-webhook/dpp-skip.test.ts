import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isDppReportEvent } from "./dpp-skip";

const ev = (object: unknown, type = "checkout.session.completed") => ({ type, data: { object } });

describe("supabase stripe-webhook DPP skip", () => {
  it("matches product_line=dpp_report or the configured DPP price, nothing else", () => {
    expect(isDppReportEvent(ev({ metadata: { product_line: "dpp_report" } }), "")).toBe(true);
    expect(isDppReportEvent(ev({ line_items: { data: [{ price: { id: "price_dppfixture" } }] } }), "price_dppfixture")).toBe(true);
    expect(isDppReportEvent(ev({ line_items: { data: [{ price: { id: "p", product: { metadata: { product_line: "dpp_report" } } } }] } }), "")).toBe(true);
    expect(isDppReportEvent(ev({ metadata: {} }), "")).toBe(false);
    expect(isDppReportEvent(ev({ metadata: { product_line: "dpp_report" } }, "invoice.paid"), "")).toBe(false);
  });

  it("index.ts returns 200 {skipped} after signature verification and before processEvent (no write)", () => {
    const src = readFileSync(join(__dirname, "index.ts"), "utf8");
    const verify = src.indexOf("constructEventAsync(payload, signature, webhookSecret)");
    const skip = src.indexOf('isDppReportEvent(event, Deno.env.get("DPP_REPORT_PRICE_ID"))');
    const process = src.indexOf("return this.processEvent(event);");
    expect(verify).toBeGreaterThan(0);
    expect(skip).toBeGreaterThan(verify);
    expect(process).toBeGreaterThan(skip);
    expect(src).toContain('JSON.stringify({ skipped: "dpp_report" })');
  });
});
