import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_PREFIXES } from "./app-prefixes";
import { DYNAMIC_HANDLER_PATHS } from "../../../worker-app/route-manifest";

describe("APP_PREFIXES", () => {
  it("forwards every public dynamic worker-app prefix", () => {
    for (const prefix of DYNAMIC_HANDLER_PATHS) {
      expect(APP_PREFIXES, prefix).toContain(prefix);
    }
  });

  it("forwards Living QR scans and the edge route owns that path", () => {
    expect(APP_PREFIXES).toContain("/qron");
    const wrangler = readFileSync(
      new URL("../../../worker-app/wrangler.toml", import.meta.url),
      "utf8"
    );
    expect(wrangler).toContain('pattern = "authichain.com/qron/r*"');
    expect(wrangler).toContain('pattern = "authichain.govchain.us/qron/r*"');
  });
});
