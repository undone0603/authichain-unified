import { describe, expect, it } from "vitest";
import { tryHandleManufacturerStatus } from "./manufacturer-status-route";

const ADDRESS = "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2";

function req(path: string, method = "GET"): Request {
  return new Request(`https://authichain.com${path}`, { method });
}

describe("manufacturer status on the apex", () => {
  it("leaves unrelated paths alone", async () => {
    const res = await tryHandleManufacturerStatus(req("/api/x402"));
    expect(res).toBeNull();
  });

  it("serves the lookup page without a payment offer", async () => {
    const res = await tryHandleManufacturerStatus(req("/verify/manufacturer"));
    expect(res?.status).toBe(200);
    const html = await res!.text();
    expect(html).toContain("latest 10,000 blocks");
    expect(html).toContain("does not take payment");
    expect(html).not.toContain("$49");
    expect(html).not.toContain("auto-granted");
  });

  it("rejects an address that cannot be a topic", async () => {
    const res = await tryHandleManufacturerStatus(
      req("/api/manufacturer-status/not-an-address/history")
    );
    expect(res?.status).toBe(400);
    expect(await res!.json()).toEqual({ error: "invalid address" });
  });

  it("returns role events from the bounded log query", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      calls.push(body.method);
      if (body.method === "eth_call") {
        const data = String(body.params[0].data);
        const minter = "9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
        const result = data.includes(minter)
          ? "0x" + "0".repeat(63) + "1"
          : "0x" + "0".repeat(64);
        return new Response(JSON.stringify({ result }));
      }
      if (body.method === "eth_blockNumber") {
        return new Response(JSON.stringify({ result: "0x5000000" }));
      }
      const topic = body.params[0].topics[0] as string;
      const log = {
        topics: [topic, "0x" + "ab".repeat(32), "0x" + "00".repeat(12) + ADDRESS.slice(2).toLowerCase(), "0x" + "11".repeat(32)],
        transactionHash: "0x" + "aa".repeat(32),
        blockNumber: "0x4fffff0",
      };
      return new Response(
        JSON.stringify({
          result: topic.startsWith("0x2f878811") ? [log] : [],
        })
      );
    }) as typeof fetch;
    const res = await tryHandleManufacturerStatus(
      req(`/api/manufacturer-status/${ADDRESS}/history`),
      fetchImpl
    );
    expect(res?.status).toBe(200);
    const body = await res!.json();
    expect(body.history).toHaveLength(1);
    expect(body.history[0].type).toBe("granted");
    expect(body.current.minter).toBe(true);
    expect(body.current.admin).toBe(false);
    expect(body.current.manufacturerVerified).toBe(false);
    expect(body.disclaimer).toContain("not the full history");
    expect(calls.filter((method) => method === "eth_call")).toHaveLength(5);
    expect(calls).toContain("eth_blockNumber");
    expect(calls.filter((method) => method === "eth_getLogs")).toHaveLength(2);
    const span = BigInt(body.currentBlock) - BigInt(body.fromBlock);
    expect(span).toBe(10_000n);
  });

  it("hides provider errors", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          error: {
            message:
              "Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode",
          },
        }),
        { status: 403 }
      )) as typeof fetch;
    const res = await tryHandleManufacturerStatus(
      req(`/api/manufacturer-status/${ADDRESS}/history`),
      fetchImpl
    );
    expect(res?.status).toBe(502);
    const body = await res!.json();
    expect(body.error).toBe("log_range_rejected");
    expect(JSON.stringify(body)).not.toContain("allnodes");
  });

  it("keeps current roles when the log window is rejected", async () => {
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (body.method === "eth_call") {
        return new Response(JSON.stringify({ result: "0x" + "0".repeat(63) + "1" }));
      }
      return new Response(
        JSON.stringify({
          error: { message: "Archive requests require a personal token" },
        }),
        { status: 403 }
      );
    }) as typeof fetch;
    const res = await tryHandleManufacturerStatus(
      req(`/api/manufacturer-status/${ADDRESS}/history`),
      fetchImpl
    );
    expect(res?.status).toBe(200);
    const body = await res!.json();
    expect(body.history).toEqual([]);
    expect(body.historyError).toBe("log_range_rejected");
    expect(body.current.minter).toBe(true);
    expect(body.current.manufacturerVerified).toBe(true);
    expect(JSON.stringify(body)).not.toContain("allnodes");
    expect(JSON.stringify(body)).not.toContain("personal token");
  });
});
