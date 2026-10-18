import { describe, expect, it } from "vitest";
import {
  ANALYTICS_DESCRIPTION,
  REGISTER_PRODUCT_DESCRIPTION,
  TRUST_SCORE_DESCRIPTION,
  VERIFY_CANNABIS_DESCRIPTION,
  VERIFY_PRODUCT_DESCRIPTION,
  registerProductBody,
  trustScoreBody,
} from "./product-tools";

describe("gateway product tools", () => {
  it("scans a stored passport and does not describe registration as an anchor", () => {
    expect(VERIFY_PRODUCT_DESCRIPTION).toMatch(/DigitalProductPassport/);
    expect(REGISTER_PRODUCT_DESCRIPTION).not.toMatch(/blockchain-anchored/i);
    expect(REGISTER_PRODUCT_DESCRIPTION).not.toMatch(/gtin/i);
    const body = registerProductBody({
      name: "Widget",
      manufacturer: "Acme",
      userId: "7",
      passport: {
        record: {
          type: ["VerifiableCredential", "DigitalProductPassport"],
          credentialSubject: { id: "urn:authichain:item:example-1" },
        },
      },
    });
    expect(body.brand).toBe("Acme");
    expect(body.manufacturer).toBe("Acme");
    expect(body.userId).toBe("7");
    expect(body.passport).toMatchObject({
      record: { credentialSubject: { id: "urn:authichain:item:example-1" } },
    });
    expect(JSON.stringify(body)).not.toMatch(/txHash|09506000134352/);
  });

  it("omits a trust-score flag the caller did not send", () => {
    expect(TRUST_SCORE_DESCRIPTION).toMatch(/DigitalProductPassport/);
    expect(TRUST_SCORE_DESCRIPTION).not.toMatch(/authentic/i);
    const body = trustScoreBody({ productId: "prod-1", nfcMatch: true });
    expect(body).toEqual({ productId: "prod-1", nfcMatch: true });
    expect(body).not.toHaveProperty("qrDecodePass");
  });

  it("describes the cannabis lookup as a stored passport scan", () => {
    expect(VERIFY_CANNABIS_DESCRIPTION).toMatch(/DigitalProductPassport/);
    expect(VERIFY_CANNABIS_DESCRIPTION).not.toMatch(/METRC|BioTrack|DSCSA/i);
    expect(ANALYTICS_DESCRIPTION).toMatch(/metering stub/);
    expect(ANALYTICS_DESCRIPTION).not.toMatch(/authenticity/i);
  });
});
