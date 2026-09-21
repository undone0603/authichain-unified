import { describe, expect, it } from "vitest";
import {
  FOUNDER_SMS_E164,
  FOUNDER_SMS_GATEWAYS,
  smsBody,
} from "./founder-alerts";

describe("founder SMS channel", () => {
  it("targets +1 989-505-6723 only", () => {
    expect(FOUNDER_SMS_E164).toBe("+19895056723");
    expect(FOUNDER_SMS_GATEWAYS.every((addr) => addr.startsWith("9895056723@"))).toBe(
      true,
    );
  });

  it("truncates SMS to 160 chars", () => {
    const text = "x".repeat(400);
    const body = smsBody({ title: "T", text, subject: "S" });
    expect(body.length).toBe(160);
    expect(body.endsWith("...")).toBe(true);
  });
});
