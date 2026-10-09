/**
 * PM-375 / PM-376: $QRON token, staking, yield, governance and treasury copy
 * was cut from every surface below. This guard keeps it from coming back.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const BANNED = /\$QRON|[Ss]tak(?:e|ed|ing)\b|[Yy]ield:|[Tt]reasury|DAO Rewards|[Ss]can-to-[Ee]arn|QRON [Rr]ewards|QRON EARNED|<span>DAO<\/span>/;

const SURFACES = [
  "src/app/_home/QronHome.tsx",
  "apps/qron-platform/src/app/page.tsx",
  "src/app/admin/page.tsx",
  "apps/qron-platform/src/app/admin/page.tsx",
  "src/app/creators/page.tsx",
  "apps/qron-platform/src/app/creators/page.tsx",
  "workers/watchchain-io/src/index.ts",
  "src/app/demo/page.tsx",
  "apps/qron-platform/src/app/demo/page.tsx",
  ...["client/src", "apps/client/src"].flatMap((r) => [
    `${r}/components/MonetizationArchitecture.tsx`,
    `${r}/pages/Home.tsx`,
    `${r}/pages/CharacterDashboard.tsx`,
    `${r}/pages/CharacterCreate.tsx`,
    `${r}/pages/NetworkStats.tsx`,
    `${r}/pages/AdminDashboard.tsx`,
    `${r}/pages/brand/StrainChainHome.tsx`,
    `${r}/pages/brand/AuthiChainHome.tsx`,
    `${r}/pages/brand/QronHome.tsx`,
  ]),
];

describe("$QRON token copy stays cut", () => {
  for (const rel of SURFACES) {
    it(`${rel} has no token/staking/yield/treasury copy`, () => {
      const hits = read(rel)
        .split(/\r?\n/)
        .map((line, i) => [i + 1, line] as const)
        .filter(([, line]) => BANNED.test(line));
      expect(hits).toEqual([]);
    });
  }

  it("the $QRON rewards, governance and staking pages stay deleted", () => {
    for (const rel of [
      "src/app/rewards/page.tsx",
      "src/app/governance/page.tsx",
      "apps/qron-platform/src/app/governance/page.tsx",
      "src/app/api/governance/route.ts",
      "client/src/pages/Staking.tsx",
      "apps/client/src/pages/Staking.tsx",
    ]) {
      expect(existsSync(path.join(ROOT, rel)), rel).toBe(false);
    }
  });
});
