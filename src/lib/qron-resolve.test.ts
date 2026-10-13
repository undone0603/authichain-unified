// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { toString as qrToString } from "qrcode";
import {
  handleQronResolve,
  objectIdFromResolvePath,
  qronPresentationKvKey,
  qronResolveUrl,
  scannableQrDataUrl,
  type StoredQronPresentation,
} from "./qron-resolve";
import { qronObjectIdForDestination } from "./qron-presentation";

const OBJECT_ID = "qron:url:deadbeef";

function stored(overrides: Partial<StoredQronPresentation> = {}): StoredQronPresentation {
  return {
    object_id: OBJECT_ID,
    destination_url: "https://example.com/sku?q=<script>",
    resolve_url: qronResolveUrl(OBJECT_ID),
    jws: "header.payload.sig",
    kid: "kid-test",
    jwks_url: "https://authichain.com/protocol/jwks.json",
    ...overrides,
  };
}

describe("qron resolve paths", () => {
  it("decodes the object id and builds a stable authichain.com URL", () => {
    const destination = "https://example.com/sku";
    const objectId = qronObjectIdForDestination(destination);
    const path = `/qron/r/${encodeURIComponent(objectId)}/`;
    expect(objectIdFromResolvePath(path)).toBe(objectId);
    expect(objectIdFromResolvePath("/qron/r/")).toBeNull();
    expect(qronResolveUrl(objectId)).toBe(
      `https://authichain.com/qron/r/${encodeURIComponent(objectId)}`
    );
    expect(qronPresentationKvKey(objectId)).toBe(`qron:presentation:${objectId}`);
  });
});

describe("scannableQrDataUrl", () => {
  it("is the SVG QR for the resolve URL", async () => {
    const resolveUrl = qronResolveUrl(OBJECT_ID);
    const dataUrl = await scannableQrDataUrl(resolveUrl);
    const svg = Buffer.from(dataUrl.split(",")[1] || "", "base64").toString("utf8");
    const expected = await qrToString(resolveUrl, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
    });
    expect(svg).toBe(expected);
    expect(svg.startsWith("<svg")).toBe(true);
    const other = await qrToString("https://example.com/other", {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
    });
    expect(svg).not.toBe(other);
  });
});

describe("handleQronResolve", () => {
  it("ignores paths that are not a resolve target", async () => {
    const response = await handleQronResolve(
      new Request("https://authichain.com/generate"),
      { load: async () => null }
    );
    expect(response).toBeNull();
  });

  it("returns indeterminate Decision v1 when nothing is stored", async () => {
    const response = await handleQronResolve(
      new Request(`https://authichain.com/qron/r/${encodeURIComponent(OBJECT_ID)}`, {
        headers: { accept: "application/json" },
      }),
      { load: async () => null }
    );
    expect(response?.status).toBe(404);
    const body = await response!.json();
    expect(body).toMatchObject({
      valid: false,
      decision: "indeterminate",
      decision_contract: "AuthiChain Verification Decision v1",
      error: "presentation_not_found",
    });
  });

  it("forwards the stored JWS and returns Decision v1 verified", async () => {
    const verify = vi.fn(async () => ({
      status: 200,
      body: {
        valid: true,
        decision: "verified",
        decision_contract: "AuthiChain Verification Decision v1",
      },
    }));
    const response = await handleQronResolve(
      new Request(`https://authichain.com/qron/r/${encodeURIComponent(OBJECT_ID)}`, {
        headers: { accept: "application/json" },
      }),
      {
        load: async () => stored(),
        verify,
      }
    );
    expect(verify).toHaveBeenCalledWith("header.payload.sig", OBJECT_ID);
    expect(response?.status).toBe(200);
    expect(await response!.json()).toMatchObject({
      valid: true,
      decision: "verified",
      decision_contract: "AuthiChain Verification Decision v1",
    });
  });

  it("POSTs the stored JWS to canonical verify when no verifier is injected", async () => {
    const calls: Array<[string, RequestInit]> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push([String(url), init ?? {}]);
      return new Response(
        JSON.stringify({
          valid: true,
          decision: "verified",
          decision_contract: "AuthiChain Verification Decision v1",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;
    const response = await handleQronResolve(
      new Request(`https://authichain.com/qron/r/${encodeURIComponent(OBJECT_ID)}`, {
        headers: { accept: "application/json" },
      }),
      { load: async () => stored(), fetchImpl }
    );
    const [url, init] = calls[0];
    expect(url).toBe("https://authichain.com/api/v1/attestation/verify");
    expect(JSON.parse(String(init.body))).toEqual({
      jws: "header.payload.sig",
      expected_object_id: OBJECT_ID,
    });
    expect(response?.status).toBe(200);
    expect((await response!.json()).decision).toBe("verified");
  });

  it("renders an HTML decision for a phone scan and escapes the destination", async () => {
    const response = await handleQronResolve(
      new Request(`https://authichain.com/qron/r/${encodeURIComponent(OBJECT_ID)}`, {
        headers: { accept: "text/html" },
      }),
      {
        load: async () => stored(),
        verify: async () => ({
          status: 200,
          body: {
            valid: true,
            decision: "verified",
            decision_contract: "AuthiChain Verification Decision v1",
          },
        }),
      }
    );
    expect(response?.headers.get("content-type")).toMatch(/html/);
    const html = await response!.text();
    expect(html).toContain("<h1>verified</h1>");
    expect(html).toContain("AuthiChain Verification Decision v1");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("rejects non-GET methods with indeterminate JSON", async () => {
    const response = await handleQronResolve(
      new Request(`https://authichain.com/qron/r/${encodeURIComponent(OBJECT_ID)}`, {
        method: "POST",
      }),
      { load: async () => stored() }
    );
    expect(response?.status).toBe(405);
    expect((await response!.json()).error).toBe("method_not_allowed");
  });

  it("returns indeterminate when canonical verify cannot be reached", async () => {
    const response = await handleQronResolve(
      new Request(`https://authichain.com/qron/r/${encodeURIComponent(OBJECT_ID)}`, {
        headers: { accept: "application/json" },
      }),
      {
        load: async () => stored(),
        fetchImpl: (async () => {
          throw new Error("network");
        }) as typeof fetch,
      }
    );
    expect(response?.status).toBe(502);
    expect((await response!.json()).error).toBe("verify_unreachable");
  });
});
