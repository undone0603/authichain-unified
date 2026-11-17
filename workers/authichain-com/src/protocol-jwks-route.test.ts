import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  PRODUCTION_ISSUER_KID,
  RETIRED_ISSUER_KID,
  RETIRED_OCT31_ISSUER_KID,
} from "./mcp-routes";
import {
  PROTOCOL_ISSUER,
  PROTOCOL_JWKS_KEYS,
  tryHandleProtocolJwks,
} from "./protocol-jwks-route";

function call(path: string, method = "GET") {
  return tryHandleProtocolJwks(
    new Request(`https://authichain.com${path}`, { method })
  );
}

function thumbprint(jwk: { crv: string; kty: string; x: string }) {
  return createHash("sha256")
    .update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x }))
    .digest("base64url");
}

describe("protocol JWKS on the landing worker", () => {
  it("publishes current jWTo5QsZ and retired T3AL7c4w, omits lue84wJN", async () => {
    const res = call("/protocol/jwks.json");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(res!.headers.get("cache-control")).toMatch(/no-store/);
    const body = (await res!.json()) as {
      keys: Array<{ kid: string; kty: string; crv: string; x: string; d?: string }>;
    };
    const kids = body.keys.map(k => k.kid);
    expect(kids).toEqual([PRODUCTION_ISSUER_KID, RETIRED_OCT31_ISSUER_KID]);
    expect(kids).not.toContain(RETIRED_ISSUER_KID);
    for (const key of body.keys) {
      expect(key.kty).toBe("OKP");
      expect(key.crv).toBe("Ed25519");
      expect(key.d).toBeUndefined();
      expect(thumbprint(key)).toBe(key.kid);
    }
  });

  it("serves /.well-known/jwks.json with the same keys", async () => {
    const wellKnown = call("/.well-known/jwks.json");
    const protocol = call("/protocol/jwks.json");
    expect(await wellKnown!.json()).toEqual(await protocol!.json());
    expect(wellKnown!.headers.get("cache-control")).toMatch(/max-age=300/);
  });

  it("issuer.json is the current kid with signing true", async () => {
    const res = call("/protocol/issuer.json");
    expect(res!.status).toBe(200);
    const body = (await res!.json()) as typeof PROTOCOL_ISSUER;
    expect(body.kid).toBe(PRODUCTION_ISSUER_KID);
    expect(body.signing).toBe(true);
    expect(body.ready).toBe(true);
    expect(body.jwks).toBe("https://authichain.com/protocol/jwks.json");
    expect(JSON.stringify(body)).not.toMatch(/BEGIN PRIVATE KEY/);
    expect(PROTOCOL_JWKS_KEYS[0]?.kid).toBe(PRODUCTION_ISSUER_KID);
  });

  it("answers HEAD and refuses POST", async () => {
    const head = call("/protocol/jwks.json", "HEAD");
    expect(head!.status).toBe(200);
    expect(await head!.text()).toBe("");
    const post = call("/protocol/issuer.json", "POST");
    expect(post!.status).toBe(405);
  });

  it("ignores other protocol paths so APP_WORKER still owns launch-proof", () => {
    expect(call("/protocol/launch-proof")).toBeNull();
    expect(call("/protocol")).toBeNull();
    expect(call("/protocol/examples/polygon-anchor-1")).toBeNull();
  });
});
