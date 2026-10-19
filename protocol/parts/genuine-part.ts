import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const GENUINE_PART_FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "genuine-part-fixture.json",
);

const FIXTURE_SIGNATURE = "fixture-signature";

export type GenuinePartFixture = {
  synthetic: true;
  source: "local-fixture";
  partIdentifier: string;
  signature: string;
  assertion: string;
};

export type GenuinePartResult = {
  partIdentifier: string;
  signatureMatches: boolean;
  genuine: false;
  physicalInspection: false;
};

export function checkGenuinePartFixture(record: GenuinePartFixture): GenuinePartResult {
  if (record?.synthetic !== true || record.source !== "local-fixture") {
    throw new Error("fixture is not the local genuine-part record");
  }
  if (typeof record.partIdentifier !== "string" || record.partIdentifier.length === 0) {
    throw new Error("fixture part identifier missing");
  }
  if ("manufacturerVerified" in record) {
    throw new Error("manufacturerVerified is not the fixture");
  }
  return {
    partIdentifier: record.partIdentifier,
    signatureMatches: record.signature === FIXTURE_SIGNATURE,
    genuine: false,
    physicalInspection: false,
  };
}

export function checkGenuinePartFile(path = GENUINE_PART_FIXTURE): GenuinePartResult {
  const record = JSON.parse(readFileSync(path, "utf8")) as GenuinePartFixture;
  return checkGenuinePartFixture(record);
}
