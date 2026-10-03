import { describe, expect, it } from "vitest";
import { APP_PREFIXES } from "./app-prefixes";
import { DYNAMIC_HANDLER_PATHS } from "../../../worker-app/route-manifest";

describe("APP_PREFIXES", () => {
  it("forwards every public dynamic worker-app prefix", () => {
    for (const prefix of DYNAMIC_HANDLER_PATHS) {
      expect(APP_PREFIXES, prefix).toContain(prefix);
    }
  });
});
