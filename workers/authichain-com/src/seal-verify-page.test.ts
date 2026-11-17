import { describe, expect, it } from "vitest";
import {
  isValidSealId,
  matchSealVerifyPath,
  payloadHasJws,
  resolverPassportUrl,
  tryHandleSealVerify,
  type FetchLike,
} from "./seal-verify-page.ts";

const KNOWN_PROVES =
  "This identifier is registered and scan pattern is consistent with a single unit.";
const KNOWN_DOES_NOT =
  "Does not prove manufacturing quality, lab results, or chain-of-custody beyond what the issuer attached.";
const UNKNOWN_PROVES = "Nothing. This identifier is not in the registry.";
const UNKNOWN_DOES_NOT =
  "Absence here is not proof of counterfeit by itself — it may be an unregistered genuine item.";

const knownPayload = {
  status: "active",
  label: "Authentic",
  proves: KNOWN_PROVES,
  doesNotProve: KNOWN_DOES_NOT,
  identifier: { serial: "AC-DEMO-001", certId: "AC-DEMO-001" },
  product: { brand: "Acme", name: "Widget" },
};

const unknownPayload = {
  status: "not_found",
  label: "Not found",
  proves: UNKNOWN_PROVES,
  doesNotProve: UNKNOWN_DOES_NOT,
  identifier: { serial: null, certId: null },
  product: null,
};

function req(path: string, method = "GET"): Request {
  return new Request(`https://authichain.com${path}`, { method });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function capturingFetch(
  handler: (url: string) => Response | Promise<Response>
): { fetchImpl: FetchLike; urls: string[] } {
  const urls: string[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    urls.push(input);
    expect(init?.method ?? "GET").toBe("GET");
    expect(String(init?.redirect ?? "")).not.toBe("follow");
    return handler(input);
  };
  return { fetchImpl, urls };
}

describe("GET /seal/{id} path matching", () => {
  it("accepts a reasonable id and rejects charset or length outliers", () => {
    expect(matchSealVerifyPath("/seal/AC-DEMO-001")).toEqual({
      ok: true,
      id: "AC-DEMO-001",
    });
    expect(matchSealVerifyPath("/seal/AC-DEMO-001/")).toEqual({
      ok: true,
      id: "AC-DEMO-001",
    });
    expect(matchSealVerifyPath("/seal/")).toBeNull();
    expect(matchSealVerifyPath("/seal")).toBeNull();
    expect(matchSealVerifyPath("/passport/AC-DEMO-001")).toBeNull();
    expect(matchSealVerifyPath("/seal/a/b")).toBeNull();
    expect(matchSealVerifyPath("/seal/%3Cscript%3E")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(isValidSealId("AC-DEMO-001")).toBe(true);
    expect(isValidSealId("x".repeat(129))).toBe(false);
    expect(isValidSealId("bad id")).toBe(false);
  });
});

describe("GET /seal/{id} render", () => {
  it("renders a known seal from the read-only resolver payload", async () => {
    const { fetchImpl, urls } = capturingFetch(() =>
      jsonResponse(knownPayload)
    );
    const res = await tryHandleSealVerify(req("/seal/AC-DEMO-001"), fetchImpl);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    const html = await res!.text();
    expect(html).toContain("Widget");
    expect(html).toContain("Acme");
    expect(html).toContain("AC-DEMO-001");
    expect(html).toMatch(/<dt>Issuance status<\/dt><dd>active<\/dd>/);
    expect(html).toMatch(/<dt>Clone state<\/dt><dd>none<\/dd>/);
    expect(html).toContain(KNOWN_PROVES);
    expect(html).toContain(KNOWN_DOES_NOT);
    expect(html).toContain("unsigned");
    expect(html).toContain("Product seals are in development");
    expect(html).toContain("does not prove a physical object is genuine");
    expect(html).not.toContain("AuthiChain, Inc.");
    expect(html).not.toContain("$29");
    expect(html).not.toContain("Starter Pack");
    expect(html).not.toContain("/checkout/");
    expect(urls).toEqual([resolverPassportUrl("AC-DEMO-001")]);
  });

  it("renders an unknown id with the resolver's honest not_found copy", async () => {
    const { fetchImpl, urls } = capturingFetch(() =>
      jsonResponse(unknownPayload, 404)
    );
    const res = await tryHandleSealVerify(req("/seal/UNKNOWN-ID"), fetchImpl);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(404);
    const html = await res!.text();
    expect(html).toContain(UNKNOWN_PROVES);
    expect(html).toContain(UNKNOWN_DOES_NOT);
    expect(html).toContain("Not found");
    expect(html).not.toContain("/checkout/");
    expect(html).not.toContain("$49");
    expect(html).not.toContain("strainchain_passport");
    expect(html).not.toContain("Starter Pack");
    expect(html).not.toContain("$29");
    expect(html).not.toContain("AuthiChain, Inc.");
    expect(urls).toEqual([resolverPassportUrl("UNKNOWN-ID")]);
  });

  it("escapes resolver values in HTML", async () => {
    const xss = "<img src=x onerror=alert(1)>";
    const { fetchImpl } = capturingFetch(() =>
      jsonResponse({
        ...knownPayload,
        proves: `safe proves ${xss}`,
        doesNotProve: `safe not ${xss}`,
        product: { brand: xss, name: `Name ${xss}` },
        identifier: { serial: xss, certId: xss },
        label: xss,
      })
    );
    const res = await tryHandleSealVerify(req("/seal/AC-DEMO-001"), fetchImpl);
    const html = await res!.text();
    expect(html).not.toContain(xss);
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toMatch(/<img src=x/i);
  });

  it("fetches only /v1/passport/ and never a scan path", async () => {
    const { fetchImpl, urls } = capturingFetch(url => {
      expect(url).toContain("/v1/passport/");
      expect(url).not.toContain("/cert/");
      expect(url).not.toContain("/verify/");
      expect(url).not.toMatch(/\/01\//);
      return jsonResponse(knownPayload);
    });
    await tryHandleSealVerify(req("/seal/AC-DEMO-001"), fetchImpl);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://id.authichain.com/v1/passport/AC-DEMO-001");
    expect(urls[0].includes("/cert/")).toBe(false);
    expect(urls.some(u => /\/cert\/|\/verify\/|\/01\//.test(u))).toBe(false);
  });

  it("fails closed on fetch errors without calling a scan path", async () => {
    const { fetchImpl, urls } = capturingFetch(() => {
      throw new Error("resolver down");
    });
    const res = await tryHandleSealVerify(req("/seal/AC-DEMO-001"), fetchImpl);
    expect(res!.status).toBe(503);
    expect(await res!.text()).toContain("could not verify right now");
    expect(urls).toEqual([resolverPassportUrl("AC-DEMO-001")]);
  });

  it("does not fetch when the id charset is invalid", async () => {
    const { fetchImpl, urls } = capturingFetch(() =>
      jsonResponse(knownPayload)
    );
    const res = await tryHandleSealVerify(req("/seal/%3Cscript%3E"), fetchImpl);
    expect(res!.status).toBe(503);
    expect(await res!.text()).toContain("could not verify right now");
    expect(urls).toEqual([]);
  });

  it("treats a missing JWS as unsigned", () => {
    expect(payloadHasJws(knownPayload)).toBe(false);
    expect(payloadHasJws({ ...knownPayload, jws: "abc.def.ghi" })).toBe(true);
  });
});
