import net from "node:net";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkFixtureReturn,
  RETURNED_PACKAGE_FIXTURE,
  SHIPPED_HISTORY_FIXTURE,
} from "./history-fixture";

const originalConnect = net.Socket.prototype.connect;
const originalFetch = globalThis.fetch;

describe("DSCSA fixture history", () => {
  afterEach(() => {
    net.Socket.prototype.connect = originalConnect;
    globalThis.fetch = originalFetch;
  });

  it("checks one fixture return against shipped history", () => {
    net.Socket.prototype.connect = function connect() {
      throw new Error("socket opened");
    } as typeof net.Socket.prototype.connect;
    globalThis.fetch = () => {
      throw new Error("socket opened");
    };
    const history = readFileSync(SHIPPED_HISTORY_FIXTURE, "utf8");
    const returned = readFileSync(RETURNED_PACKAGE_FIXTURE, "utf8");
    const result = checkFixtureReturn();
    expect(history).toContain(result.packageIdentifier);
    expect(returned).toContain(result.packageIdentifier);
    expect(result.packageIdentifier).toBe("fixture-package-0001");
    expect(result.matchesShippedHistory).toBe(true);
    expect(result.dscsaCompliance).toBe(false);
  });
});
