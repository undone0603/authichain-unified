import net from "node:net";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { checkGenuinePartFile, GENUINE_PART_FIXTURE } from "./genuine-part";

const originalConnect = net.Socket.prototype.connect;
const originalFetch = globalThis.fetch;

describe("genuine-part fixture", () => {
  afterEach(() => {
    net.Socket.prototype.connect = originalConnect;
    globalThis.fetch = originalFetch;
  });

  it("checks one fixture record for a genuine-part result", () => {
    net.Socket.prototype.connect = function connect() {
      throw new Error("socket opened");
    } as typeof net.Socket.prototype.connect;
    globalThis.fetch = () => {
      throw new Error("socket opened");
    };
    const raw = readFileSync(GENUINE_PART_FIXTURE, "utf8");
    const result = checkGenuinePartFile();
    expect(raw).toContain(result.partIdentifier);
    expect(raw).toContain("fixture-signature");
    expect(result.partIdentifier).toBe("fixture-part-0001");
    expect(result.signatureMatches).toBe(true);
    expect(result.genuine).toBe(false);
    expect(result.physicalInspection).toBe(false);
  });
});
