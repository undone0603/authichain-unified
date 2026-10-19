import net from "node:net";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { METRC_FIXTURE, readFixturePackageFile } from "./metrc-fixture";

const originalConnect = net.Socket.prototype.connect;
const originalFetch = globalThis.fetch;

describe("METRC fixture package", () => {
  afterEach(() => {
    net.Socket.prototype.connect = originalConnect;
    globalThis.fetch = originalFetch;
  });

  it("reads one METRC or BioTrack fixture package", () => {
    net.Socket.prototype.connect = function connect() {
      throw new Error("socket opened");
    } as typeof net.Socket.prototype.connect;
    globalThis.fetch = () => {
      throw new Error("socket opened");
    };
    const raw = readFileSync(METRC_FIXTURE, "utf8");
    const result = readFixturePackageFile();
    expect(raw).toContain(result.packageId);
    expect(result.program).toBe("METRC");
    expect(result.packageId).toBe("FIXTURE-PACKAGE-0001");
  });
});
