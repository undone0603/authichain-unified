// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assessChainRead } from "../../../../../workers/authichain-verify-worker/src/protocol-verify.mjs";
import { generateStateHash } from "../../../../lib/industrial/telemetry";
import {
  TELEMETRY_QUERY_SENTENCE,
  TELEMETRY_RPC_CAP,
  summarizeTelemetry,
  type TelemetryCountRow,
} from "../../../../lib/industrial/telemetry-counts";

const ROUTE = readFileSync(path.join(import.meta.dirname, "route.ts"), "utf8");
const STATE = generateStateHash({ theater: "theater_1", identity: "unit-1" });
const OTHER = generateStateHash({ theater: "theater_3", identity: "unit-2" });
const TX = "0x" + "ab".repeat(32);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function chainFetch(input: string, receiptStatus = "0x1") {
  const calls: Array<{ method: string; params: string[] }> = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as {
      method: string;
      params: string[];
    };
    calls.push({ method: body.method, params: body.params });
    if (body.method === "eth_getTransactionByHash") {
      return json({
        jsonrpc: "2.0",
        id: 1,
        result: { input: "0x" + input, from: TX, to: TX },
      });
    }
    return json({
      jsonrpc: "2.0",
      id: 1,
      result: { status: receiptStatus, blockNumber: "0x10" },
    });
  };
  return { calls, fetchImpl };
}

describe("summarizeTelemetry", () => {
  it("reads an empty table as zeros", async () => {
    const fetchImpl = async () => {
      throw new Error("rpc was called");
    };
    const body = await summarizeTelemetry([], {
      rpcUrl: "https://polygon.test/rpc",
      fetchImpl,
    });
    expect(body.verified).toBe(false);
    expect(body.message).toBe(TELEMETRY_QUERY_SENTENCE);
    expect(body.telemetry).toEqual({
      distinctSources: 0,
      readingsInWindow: 0,
      theaters: [],
      blockchainAnchored: false,
      anchorReceiptsQueried: false,
    });
    expect(body.devices).toEqual([]);
    expect(body.recentEvents).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(
      /totalDevices|activeDevices|offlineDevices|polygonTxCount/
    );
    expect(JSON.stringify(body)).not.toContain("Theater 1 (METRC)");
    expect(Object.hasOwn(body, "genuine")).toBe(false);
  });

  it("counts distinct sources and stored theater values", async () => {
    const rows: TelemetryCountRow[] = [
      { source: "edge-a", theater: "theater_1", state_hash: STATE },
      { source: "edge-a", theater: "theater_3", state_hash: OTHER },
      { source: null, theater: "theater_1", state_hash: STATE },
      { source: "  ", theater: "theater_3" },
    ];
    const body = await summarizeTelemetry(rows, { rpcUrl: null });
    expect(body.telemetry.distinctSources).toBe(1);
    expect(body.telemetry.readingsInWindow).toBe(4);
    expect(body.telemetry.theaters).toEqual(["theater_1", "theater_3"]);
    expect(body.telemetry.blockchainAnchored).toBe(false);
    expect(body.telemetry.anchorReceiptsQueried).toBe(false);
    expect(body.message).toBe(TELEMETRY_QUERY_SENTENCE);
  });

  it("anchors only when the receipt input contains state_hash", async () => {
    const rows: TelemetryCountRow[] = [
      {
        source: "edge-a",
        theater: "theater_1",
        state_hash: STATE,
        ledger_hash: OTHER,
        anchored_tx_hash: TX,
      },
    ];
    const direct = assessChainRead({
      tx: { input: "0x" + STATE },
      receipt: { status: "0x1", blockNumber: "0x10" },
      recordHash: STATE,
    });
    expect(direct.status).toBe("tx_contains_record_hash");
    const ledgerOnly = assessChainRead({
      tx: { input: "0x" + OTHER },
      receipt: { status: "0x1" },
      recordHash: STATE,
    });
    expect(ledgerOnly.status).toBe("hash_not_in_tx");

    const hit = chainFetch(STATE);
    const anchored = await summarizeTelemetry(rows, {
      rpcUrl: "https://polygon.test/rpc",
      fetchImpl: hit.fetchImpl,
    });
    expect(anchored.telemetry.blockchainAnchored).toBe(true);
    expect(anchored.telemetry.anchorReceiptsQueried).toBe(true);
    expect(hit.calls.map(call => call.method).sort()).toEqual([
      "eth_getTransactionByHash",
      "eth_getTransactionReceipt",
    ]);

    const miss = chainFetch(OTHER);
    const unread = await summarizeTelemetry(rows, {
      rpcUrl: "https://polygon.test/rpc",
      fetchImpl: miss.fetchImpl,
    });
    expect(unread.telemetry.blockchainAnchored).toBe(false);
    expect(unread.telemetry.anchorReceiptsQueried).toBe(true);

    const reverted = chainFetch(STATE, "0x0");
    const failed = await summarizeTelemetry(rows, {
      rpcUrl: "https://polygon.test/rpc",
      fetchImpl: reverted.fetchImpl,
    });
    expect(failed.telemetry.blockchainAnchored).toBe(false);
  });

  it("does not call RPC when the URL is unset", async () => {
    let called = false;
    const body = await summarizeTelemetry(
      [
        {
          source: "edge-a",
          theater: "theater_1",
          state_hash: STATE,
          anchored_tx_hash: TX,
        },
      ],
      {
        rpcUrl: "  ",
        fetchImpl: async () => {
          called = true;
          return json({});
        },
      }
    );
    expect(called).toBe(false);
    expect(body.telemetry.blockchainAnchored).toBe(false);
    expect(body.telemetry.anchorReceiptsQueried).toBe(false);
  });

  it("skips RPC when more than 8 distinct transaction ids are stored", async () => {
    const rows: TelemetryCountRow[] = Array.from(
      { length: TELEMETRY_RPC_CAP + 1 },
      (_, index) => ({
        source: "edge-a",
        theater: "theater_1",
        state_hash: STATE,
        anchored_tx_hash: "0x" + index.toString(16).padStart(64, "0"),
      })
    );
    let called = false;
    const body = await summarizeTelemetry(rows, {
      rpcUrl: "https://polygon.test/rpc",
      fetchImpl: async () => {
        called = true;
        return json({});
      },
    });
    expect(called).toBe(false);
    expect(body.telemetry.blockchainAnchored).toBe(false);
    expect(body.telemetry.anchorReceiptsQueried).toBe(false);
    expect(body.telemetry.reason).toBe("rpc_cap");
    expect(body.telemetry.readingsInWindow).toBe(9);
  });

  it("reads 8 distinct transaction ids", async () => {
    const rows: TelemetryCountRow[] = Array.from(
      { length: TELEMETRY_RPC_CAP },
      (_, index) => ({
        theater: "theater_3",
        state_hash: STATE,
        anchored_tx_hash: "0x" + (index + 1).toString(16).padStart(64, "0"),
      })
    );
    const calls: string[] = [];
    const body = await summarizeTelemetry(rows, {
      rpcUrl: "https://polygon.test/rpc",
      fetchImpl: async (_url, init) => {
        const req = JSON.parse(String(init?.body)) as { method: string };
        calls.push(req.method);
        if (req.method === "eth_getTransactionByHash") {
          return json({ result: { input: "0x" + STATE } });
        }
        return json({ result: { status: "0x1", blockNumber: "0x2" } });
      },
    });
    expect(
      calls.filter(method => method === "eth_getTransactionByHash")
    ).toHaveLength(8);
    expect(body.telemetry.blockchainAnchored).toBe(true);
    expect(body.telemetry.anchorReceiptsQueried).toBe(true);
    expect(body.telemetry.reason).toBeUndefined();
  });
});

describe("telemetry route source", () => {
  it("keeps the retired device counts and the chain write out of the route", () => {
    expect(ROUTE).not.toMatch(/totalDevices|activeDevices|offlineDevices/);
    expect(ROUTE).not.toContain("Theater 1 (METRC)");
    expect(ROUTE).not.toContain("1842");
    expect(ROUTE).not.toContain("anchorEdgeHash");
    expect(ROUTE).toContain("anchored_tx_hash: null");
    expect(ROUTE).toContain(
      'select("source,theater,state_hash,anchored_tx_hash")'
    );
    expect(ROUTE).toContain("summarizeTelemetry");
    expect(ROUTE).not.toContain("ledger_hash");
  });
});
