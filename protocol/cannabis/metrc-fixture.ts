import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const METRC_FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "metrc-or-biotrack-package.json",
);

export type FixturePackage = {
  synthetic: true;
  source: "local-fixture";
  program: "METRC" | "BioTrack";
  packageId: string;
};

export type FixturePackageRead = {
  program: "METRC" | "BioTrack";
  packageId: string;
};

export function readFixturePackage(record: FixturePackage): FixturePackageRead {
  if (record?.synthetic !== true || record.source !== "local-fixture") {
    throw new Error("fixture is not a local package");
  }
  if (record.program !== "METRC" && record.program !== "BioTrack") {
    throw new Error("fixture program is not METRC or BioTrack");
  }
  if (typeof record.packageId !== "string" || record.packageId.length === 0) {
    throw new Error("fixture package id missing");
  }
  return { program: record.program, packageId: record.packageId };
}

export function readFixturePackageFile(path = METRC_FIXTURE): FixturePackageRead {
  const record = JSON.parse(readFileSync(path, "utf8")) as FixturePackage;
  return readFixturePackage(record);
}
