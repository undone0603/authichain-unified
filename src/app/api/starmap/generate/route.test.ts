import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  makePayload: vi.fn(),
  renderNightstamp: vi.fn(),
}));

vi.mock("@/lib/starmap/render", () => ({
  localCivilToDate: vi.fn(() => new Date("2026-10-04T22:00:00.000Z")),
  makePayload: mocks.makePayload,
  renderNightstamp: mocks.renderNightstamp,
}));

import { POST } from "./route";

afterEach(() => {
  mocks.makePayload.mockReset();
  mocks.renderNightstamp.mockReset();
});

const input = {
  dateISO: "2026-10-04",
  time: "22:00",
  lat: 44.7631,
  lon: -85.6206,
  tz: "America/Detroit",
  placeLabel: "Traverse City, MI",
};

describe("POST /api/starmap/generate", () => {
  it.each(["digital", "portal", "certified"])(
    "requires checkout before generating the %s SKU",
    async sku => {
      const response = await POST(
        new Request("https://qron.space/api/starmap/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...input, sku }),
        })
      );

      expect(response.status).toBe(402);
      expect(await response.json()).toMatchObject({
        code: "PAYMENT_REQUIRED",
        checkout_endpoint: "/api/starmap/checkout",
      });
      expect(mocks.makePayload).not.toHaveBeenCalled();
      expect(mocks.renderNightstamp).not.toHaveBeenCalled();
    }
  );

  it("keeps the anonymous preview path available without persisting it", async () => {
    const payload = {
      id: "preview-1",
      url: "https://qron.space/sky/preview-1",
      eventAt: "2026-10-05T02:00:00.000Z",
      catalogHash: "hash",
    };
    mocks.makePayload.mockResolvedValue(payload);
    mocks.renderNightstamp.mockResolvedValue(Buffer.from("png"));

    const response = await POST(
      new Request("https://qron.space/api/starmap/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input, sku: "preview" }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      payload,
      preview: true,
      png: `data:image/png;base64,${Buffer.from("png").toString("base64")}`,
    });
    expect(mocks.renderNightstamp).toHaveBeenCalledWith(
    expect.objectContaining({ sku: "preview" }),
    payload,
    true
    );
  });
});
