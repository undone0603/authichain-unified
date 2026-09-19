import { describe, it, expect } from "vitest";
import { genesisTargetUrl } from "./genesis-launch.js";

describe("genesisTargetUrl", () => {
  it("defaults to localhost /api/automation/cron", () => {
    const prev = process.env.GENESIS_URL;
    const prev2 = process.env.CRON_BASE_URL;
    delete process.env.GENESIS_URL;
    delete process.env.CRON_BASE_URL;
    expect(genesisTargetUrl()).toBe("http://localhost:3000/api/automation/cron");
    if (prev !== undefined) process.env.GENESIS_URL = prev;
    if (prev2 !== undefined) process.env.CRON_BASE_URL = prev2;
  });

  it("uses GENESIS_URL without a trailing slash doubling the path", () => {
    const prev = process.env.GENESIS_URL;
    process.env.GENESIS_URL = "https://authichain.com/";
    expect(genesisTargetUrl()).toBe("https://authichain.com/api/automation/cron");
    if (prev === undefined) delete process.env.GENESIS_URL;
    else process.env.GENESIS_URL = prev;
  });
});
