import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

export const SHIPPED_HISTORY_FIXTURE = join(dir, "shipped-history.json");
export const RETURNED_PACKAGE_FIXTURE = join(dir, "returned-package.json");

type ShippedHistory = {
  synthetic: true;
  source: "local-fixture";
  packageIdentifier: string;
  returnedPackage: string;
  transactions: { event: string; packageIdentifier: string }[];
};

type ReturnedPackage = {
  synthetic: true;
  source: "local-fixture";
  packageIdentifier: string;
};

export type HistoryCheck = {
  packageIdentifier: string;
  matchesShippedHistory: boolean;
  dscsaCompliance: false;
};

export function checkReturnAgainstShippedHistory(
  history: ShippedHistory,
  returned: ReturnedPackage,
): HistoryCheck {
  if (history?.synthetic !== true || returned?.synthetic !== true) {
    throw new Error("fixture is not local history");
  }
  if (history.source !== "local-fixture" || returned.source !== "local-fixture") {
    throw new Error("fixture is not local history");
  }
  if (history.returnedPackage !== "returned-package.json") {
    throw new Error("returned package fixture missing");
  }
  const shippedIds = history.transactions.map((row) => row.packageIdentifier);
  return {
    packageIdentifier: returned.packageIdentifier,
    matchesShippedHistory:
      returned.packageIdentifier === history.packageIdentifier &&
      shippedIds.includes(returned.packageIdentifier),
    dscsaCompliance: false,
  };
}

export function checkFixtureReturn(): HistoryCheck {
  const history = JSON.parse(readFileSync(SHIPPED_HISTORY_FIXTURE, "utf8")) as ShippedHistory;
  const returned = JSON.parse(readFileSync(RETURNED_PACKAGE_FIXTURE, "utf8")) as ReturnedPackage;
  return checkReturnAgainstShippedHistory(history, returned);
}
