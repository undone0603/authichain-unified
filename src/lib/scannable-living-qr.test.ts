// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  LIVING_QR_SCAN_DISCLAIMER,
  artPromptForQronImageGen,
  composeScannableLivingQr,
  decodePngDataUrl,
  rasterToPngDataUrl,
} from "./scannable-living-qr";
import { qronObjectIdForDestination } from "./qron-presentation";
import { qronResolveUrl } from "./qron-resolve";
import { toGray } from "./qron-studio/perturb";
import { DEFAULT_DECODERS } from "./qron-studio/validate";
import type { Raster } from "./qron-studio/render";

const STOREFRONT =
  "https://www.example-brand.com/products/living-qr-pack?sku=AC-100";

function decodeAll(dataUrl: string): (string | null)[] {
  const raster = decodePngDataUrl(dataUrl);
  expect(raster).not.toBeNull();
  const gray = toGray(raster!);
  return DEFAULT_DECODERS.map(d => d.decode(gray));
}

function gradientArt(): Raster {
  const width = 64;
  const height = 64;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = Math.round((x / (width - 1)) * 255);
      data[i + 1] = Math.round((y / (height - 1)) * 180);
      data[i + 2] = 40;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

describe("artPromptForQronImageGen", () => {
  it("never forwards a destination URL into the image-model prompt", () => {
    const prompt = artPromptForQronImageGen(
      `gold vault for ${STOREFRONT} please`
    );
    expect(prompt).toContain("gold vault");
    expect(prompt).not.toMatch(/https?:\/\//i);
    expect(prompt).not.toContain("example-brand.com");
    expect(prompt.toLowerCase()).toContain("no qr code");
    expect(prompt.toLowerCase()).toContain("no url");
  });
});

describe("composeScannableLivingQr", () => {
  it("keeps the public disclaimer", () => {
    expect(LIVING_QR_SCAN_DISCLAIMER).toBe(
      "A scannable QR is not an authenticity proof."
    );
  });

  it("decodes to the exact payload on jsQR and ZXing", () => {
    const living = composeScannableLivingQr({
      payload: STOREFRONT,
      style: "gold_vault",
    });
    expect(living.disclaimer).toBe(LIVING_QR_SCAN_DISCLAIMER);
    expect(living.ecl === "H" || living.ecl === "M").toBe(true);
    expect(living.imageUrl.startsWith("data:image/png;base64,")).toBe(true);
    const [jsqr, zxing] = decodeAll(living.imageUrl);
    expect(jsqr).toBe(STOREFRONT);
    expect(zxing).toBe(STOREFRONT);
  });

  it("stays scannable after blending a PNG artwork field into data modules", () => {
    const art = rasterToPngDataUrl(gradientArt());
    const living = composeScannableLivingQr({
      payload: STOREFRONT,
      artworkDataUrl: art,
      style: "neon_cyber",
    });
    expect(living.blendedArtwork).toBe(true);
    const [jsqr, zxing] = decodeAll(living.imageUrl);
    expect(jsqr).toBe(STOREFRONT);
    expect(zxing).toBe(STOREFRONT);
  });

  it("ignores garbled non-PNG model output and still encodes the URL", () => {
    const living = composeScannableLivingQr({
      payload: "https://authichain.com/checkout/starter",
      artworkDataUrl: "data:image/png;base64,abc",
      style: "marble_white",
    });
    expect(living.blendedArtwork).toBe(false);
    const [jsqr, zxing] = decodeAll(living.imageUrl);
    expect(jsqr).toBe("https://authichain.com/checkout/starter");
    expect(zxing).toBe("https://authichain.com/checkout/starter");
  });

  it("decodes signed-in resolve URLs on jsQR and ZXing", () => {
    const payload = qronResolveUrl(
      qronObjectIdForDestination("https://example.com/sku")
    );
    const living = composeScannableLivingQr({
      payload,
      style: "luxury_dark",
    });
    const [jsqr, zxing] = decodeAll(living.imageUrl);
    expect(jsqr).toBe(payload);
    expect(zxing).toBe(payload);
  });
});
