import { describe, expect, it } from "vitest";
import { tryHandleProtocolExample } from "./protocol-example-route";

function call(path: string, method = "GET") {
  return tryHandleProtocolExample(
    new Request(`https://authichain.com${path}`, { method })
  );
}

describe("published polygon-anchor-1 files", () => {
  it("serves the credential subject URL as the record", async () => {
    const res = call("/protocol/examples/polygon-anchor-1");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(res!.headers.get("content-type")).toContain("application/json");
    const body = (await res!.json()) as {
      type: string[];
      proof: { type: string };
      credentialSubject: { id: string };
    };
    expect(body.type).toContain("ProvenanceRecord");
    expect(body.proof.type).toBe("Ed25519Signature2020");
    expect(body.credentialSubject.id).toBe(
      "https://authichain.com/protocol/examples/polygon-anchor-1"
    );
    expect(JSON.stringify(body)).not.toMatch(/privateKey/i);
  });

  it("serves the record and anchor files", async () => {
    const record = call("/protocol/examples/polygon-anchor-1.record.json");
    const anchor = call("/protocol/examples/polygon-anchor-1.anchor.json");
    expect(record!.status).toBe(200);
    expect(anchor!.status).toBe(200);
    const anchorBody = (await anchor!.json()) as {
      txHash: string;
      recordHash: string;
      chain: string;
    };
    expect(anchorBody.chain).toBe("polygon:137");
    expect(anchorBody.txHash).toBe(
      "0x24911473b03c19f3b1ee9b0887fd82ef648bf2c85386f9505a0336a9c1ae10b7"
    );
    expect(anchorBody.recordHash).toBe(
      "sha256:5ee3e5e7e8b2c32c8f096b77cc41baece9dd2555d5af24d73f8880484ed6b1e1"
    );
  });

  it("answers HEAD and refuses POST", async () => {
    const head = call("/protocol/examples/polygon-anchor-1.anchor.json", "HEAD");
    expect(head!.status).toBe(200);
    expect(await head!.text()).toBe("");
    const post = call("/protocol/examples/polygon-anchor-1", "POST");
    expect(post!.status).toBe(405);
  });

  it("ignores an unknown path", () => {
    expect(call("/protocol/examples/not-published")).toBeNull();
    expect(call("/protocol")).toBeNull();
  });
});
