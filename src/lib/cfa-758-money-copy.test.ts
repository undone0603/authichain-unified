/**
 * CFA-758: money-route HTML/JS must not ship "50 workspace generation(s)"
 * or never-expire / no-expiry pack-credit claims.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const BANNED = [
  /50 workspace generations?/i,
  /never[- ]expire/i,
  /no[- ]expiry/i,
];

const MONEY_SOURCES = [
  "src/lib/plans.ts",
  "src/lib/checkout-gate.ts",
  "src/lib/generate-api.ts",
  "src/app/terms/page.tsx",
  "src/app/_home/QronHome.tsx",
  "apps/qron-platform/src/lib/plans.ts",
  "apps/qron-platform/src/app/page.tsx",
  "apps/qron-platform/src/app/terms/page.tsx",
  "worker-app/dynamic-pages.ts",
  "workers/authichain-api-gateway/src/index.ts",
  "workers/authichain-com/src/index.ts",
  "workers/authichain-com/src/money-surfaces.ts",
  "workers/authichain-com/src/dpp-routes.ts",
  "workers/authichain-com/src/battery-passport-page.ts",
  "workers/authichain-com/src/desk.ts",
  "workers/authichain-com/src/legal-pages.ts",
  "workers/authichain-com/content/docs/public/dpp-architecture.md",
];

describe("CFA-758 money-route copy", () => {
  for (const rel of MONEY_SOURCES) {
    it(`${rel} has no banned pack/workspace claims`, () => {
      const text = read(rel);
      for (const re of BANNED) {
        expect(text.match(re), `${rel} matched ${re}`).toBeNull();
      }
    });
  }
});
