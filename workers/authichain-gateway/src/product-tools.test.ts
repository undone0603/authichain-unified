import { describe, expect, it } from "vitest";
import {
  REGISTER_PRODUCT_DESCRIPTION,
  VERIFY_PRODUCT_DESCRIPTION,
  registerProductBody,
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
});
