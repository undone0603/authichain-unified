import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsStub } from "./analytics-stub";
import {
  analyticsResponse,
  countPassportVerdicts,
  finishPassportScan,
  METERING_ON_SENTENCE,
  passportScanLogRow,
  periodStart,
  readPassportScanCounts,
  recordPassportScan,
  type PassportScanLogRow,
} from "./passport-scan-log";
import type { PassportVerdict } from "./passport-verdict";

const SERIAL = "SEAL-UNIT-0001-ABCD";
const IDENTITY = "urn:authichain:item:example-1";

const genuine: PassportVerdict = {
  verified: true,
  onRecord: true,
  genuine: true,
  digitalIdentity: IDENTITY,
  productBinding: {
    method: "seal_serial_sha256",
    pass: true,
    reason: null,
    samePassport: true,
  },
  message: "Genuine product passport.",
};

const notGenuine: PassportVerdict = {
  verified: false,
  onRecord: true,
  genuine: false,
  digitalIdentity: IDENTITY,
  message: "Stored passport did not verify as genuine.",
};

const noPassport: PassportVerdict = {
  verified: false,
  onRecord: false,
  message: "No product is on record for this id.",
};

function restoreMetering(previous: string | undefined) {
  if (previous === undefined) delete process.env.PASSPORT_SCAN_METERING;
  else process.env.PASSPORT_SCAN_METERING = previous;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("passportScanLogRow", () => {
  it("records the verdict and the binding, and drops the seal serial", () => {
    const row = passportScanLogRow({
      ...genuine,
      sealSerial: SERIAL,
    } as PassportVerdict);
    expect(row).toEqual({
      digitalIdentity: IDENTITY,
      verdict: "genuine",
      bindingMethod: "seal_serial_sha256",
      bindingPass: true,
    });
    expect(JSON.stringify(row)).not.toContain(SERIAL);
    expect(Object.keys(row).sort()).toEqual([
      "bindingMethod",
      "bindingPass",
      "digitalIdentity",
      "verdict",
    ]);
  });

  it("stores a failed passport as not genuine", () => {
    expect(passportScanLogRow(notGenuine).verdict).toBe("not_genuine");
    expect(passportScanLogRow(notGenuine).digitalIdentity).toBe(IDENTITY);
  });

  it("stores a missing passport with a null identity", () => {
    const row = passportScanLogRow({
      ...noPassport,
      digitalIdentity: IDENTITY,
    });
    expect(row).toMatchObject({
      verdict: "no_passport",
      digitalIdentity: null,
      bindingMethod: null,
      bindingPass: null,
    });
  });
});

describe("recordPassportScan", () => {
  it("does not insert while the flag is off", async () => {
    const previous = process.env.PASSPORT_SCAN_METERING;
    delete process.env.PASSPORT_SCAN_METERING;
    const rows: PassportScanLogRow[] = [];
    await recordPassportScan(genuine, {
      insert: async row => {
        rows.push(row);
      },
    });
    expect(rows).toEqual([]);
    restoreMetering(previous);
  });

  it("inserts one row per call when the flag is on", async () => {
    const rows: PassportScanLogRow[] = [];
    await recordPassportScan(genuine, {
      enabled: true,
      insert: async row => {
        rows.push(row);
      },
    });
    await recordPassportScan(genuine, {
      enabled: true,
      insert: async row => {
        rows.push(row);
      },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(rows[1]);
  });
});

describe("finishPassportScan", () => {
  it("stays quiet while the flag is off", async () => {
    const previous = process.env.PASSPORT_SCAN_METERING;
    delete process.env.PASSPORT_SCAN_METERING;
    let called = false;
    await finishPassportScan(genuine, {
      insert: async () => {
        called = true;
      },
    });
    expect(called).toBe(false);
    restoreMetering(previous);
  });

  it("does not log the row when the insert fails", async () => {
    const previous = process.env.PASSPORT_SCAN_METERING;
    process.env.PASSPORT_SCAN_METERING = "true";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await finishPassportScan(
      { ...genuine, sealSerial: SERIAL } as PassportVerdict,
      {
        insert: async () => {
          throw new Error(`${SERIAL} failed`);
        },
      }
    );
    expect(spy).toHaveBeenCalledWith("[Internal API] passport scan log error");
    expect(spy.mock.calls.flat().join(" ")).not.toContain(SERIAL);
    restoreMetering(previous);
  });
});

describe("countPassportVerdicts", () => {
  it("counts the three verdicts and does not emit a rate", () => {
    const counts = countPassportVerdicts(
      [
        { verdict: "genuine", n: 2 },
        { verdict: "not_genuine", n: 1 },
        { verdict: "no_passport", n: 4 },
        { verdict: "counterfeit", n: 9 },
      ],
      "30d"
    );
    expect(counts).toEqual({
      period: "30d",
      genuine: 2,
      not_genuine: 1,
      no_passport: 4,
      message:
        "In 30d, recorded passport scans were 2 genuine, 1 not genuine, and 4 with no passport. These counts are scans recorded by AuthiChain. They are not a market counterfeit rate.",
    });
    expect(counts.message).toBe(
      METERING_ON_SENTENCE.replace("{period}", "30d")
        .replace("{genuine}", "2")
        .replace("{notGenuine}", "1")
        .replace("{noPassport}", "4")
    );
    expect(Object.keys(counts)).not.toContain("rate");
    expect(JSON.stringify(counts)).not.toMatch(
      /authentications|counterfeitRate|authentic\b/
    );
  });

  it("uses the same sentence when the period has zero rows", () => {
    const counts = countPassportVerdicts([], "30d");
    expect(counts.genuine).toBe(0);
    expect(counts.not_genuine).toBe(0);
    expect(counts.no_passport).toBe(0);
    expect(counts.message).toContain(
      "were 0 genuine, 0 not genuine, and 0 with no passport"
    );
  });
});

describe("periodStart", () => {
  it("limits a parsed period and refuses to widen an unknown one", () => {
    const now = new Date("2026-10-18T00:00:00.000Z");
    expect(periodStart("30d", now)?.toISOString()).toBe(
      "2026-09-18T00:00:00.000Z"
    );
    expect(periodStart("1h", now)?.getTime()).toBe(now.getTime() - 3_600_000);
    expect(periodStart("week", now)).toBeNull();
    expect(periodStart("0d", now)).toBeNull();
    expect(periodStart("3661d", now)).toBeNull();
  });
});

describe("analyticsResponse", () => {
  it("returns the stub while the flag is off even when a database handle exists", async () => {
    let selected = false;
    const db = {
      select() {
        selected = true;
        throw new Error("scan log was read");
      },
    };
    const reply = await analyticsResponse("30d", db as never, {});
    expect(reply.status).toBe(200);
    expect(reply.body).toEqual(analyticsStub("30d"));
    expect(reply.body).toMatchObject({
      message:
        "Usage metering is not active. These counts are not a passport scan.",
    });
    expect(selected).toBe(false);
  });

  it("returns 503 when the database handle is missing", async () => {
    const reply = await analyticsResponse("30d", null, {
      PASSPORT_SCAN_METERING: "true",
    });
    expect(reply).toEqual({
      status: 503,
      body: { error: "Database unavailable" },
    });
  });

  it("counts passport_scan_log rows when the flag is on", async () => {
    const query = {
      from() {
        return query;
      },
      where() {
        return query;
      },
      groupBy() {
        return Promise.resolve([
          { verdict: "genuine", n: 1 },
          { verdict: "no_passport", n: 2 },
        ]);
      },
    };
    const db = {
      select(shape: Record<string, unknown>) {
        expect(Object.keys(shape).sort()).toEqual(["n", "verdict"]);
        return query;
      },
    };
    const reply = await readPassportScanCounts(
      db as never,
      "30d",
      new Date("2026-10-18T00:00:00.000Z")
    );
    expect(reply).toMatchObject({
      genuine: 1,
      not_genuine: 0,
      no_passport: 2,
      period: "30d",
    });
    expect(reply.message).toBe(
      "In 30d, recorded passport scans were 1 genuine, 0 not genuine, and 2 with no passport. These counts are scans recorded by AuthiChain. They are not a market counterfeit rate."
    );
  });

  it("does not scan the table for an unparsed period", async () => {
    let selected = false;
    const db = {
      select() {
        selected = true;
        throw new Error("full scan");
      },
    };
    const reply = await readPassportScanCounts(db as never, "week");
    expect(selected).toBe(false);
    expect(reply.genuine).toBe(0);
    expect(
      reply.message.startsWith(
        "In week, recorded passport scans were 0 genuine"
      )
    ).toBe(true);
  });
});

describe("passport scan metering call sites", () => {
  const serverDir = import.meta.dirname;
  const root = path.join(serverDir, "..");
  const internal = readFileSync(
    path.join(serverDir, "internal-api.ts"),
    "utf8"
  );
  const log = readFileSync(
    path.join(serverDir, "passport-scan-log.ts"),
    "utf8"
  );
  const verdict = readFileSync(
    path.join(serverDir, "passport-verdict.ts"),
    "utf8"
  );
  const worker = readFileSync(
    path.join(root, "worker-app", "index.ts"),
    "utf8"
  );
  const protocol = readFileSync(
    path.join(
      root,
      "workers",
      "authichain-verify-worker",
      "src",
      "protocol-verify.mjs"
    ),
    "utf8"
  );
  const drizzleSchema = readFileSync(
    path.join(root, "drizzle", "schema.ts"),
    "utf8"
  );
  const srcSchema = readFileSync(
    path.join(root, "src", "db", "schema.ts"),
    "utf8"
  );
  const sql = readFileSync(
    path.join(root, "drizzle", "migrations", "026_passport_scan_log.sql"),
    "utf8"
  );
  const journal = readFileSync(
    path.join(root, "drizzle", "migrations", "meta", "_journal.json"),
    "utf8"
  );

  it("writes only from POST /verify", () => {
    const verify = internal.slice(
      internal.indexOf('router.post("/verify"'),
      internal.indexOf('router.post("/qr/generate"')
    );
    expect(verify).toContain("finishPassportScan");
    expect(internal.match(/finishPassportScan/g)).toHaveLength(2);
    expect(internal).not.toContain("recordPassportScan");
    for (const marker of [
      'router.post("/certificates/verify"',
      'router.post("/cannabis/verify"',
      'router.post("/trust-score"',
    ]) {
      const block = internal.slice(
        internal.indexOf(marker),
        internal.indexOf(marker) + 700
      );
      expect(block).not.toContain("finishPassportScan");
      expect(block).not.toContain("recordPassportScan");
    }
    expect(verdict).not.toContain("passport-scan-log");
    expect(verdict).not.toContain("passport_scan_log");
    expect(worker).not.toContain("passport-scan-log");
    expect(worker).not.toContain("finishPassportScan");
    expect(protocol).not.toContain("passport_scan_log");
    expect(protocol).not.toContain("recordPassportScan");
  });

  it("does not read authentications or keep the seal serial", () => {
    expect(log).not.toMatch(
      /authentications|qrScanEvents|qr_scan_events|aggregateAuthentications|sealSerial/
    );
    expect(sql).not.toMatch(
      /tenant|brand|seal_serial|authentications|qr_scan_events/i
    );
    expect(sql).toContain(
      'CREATE INDEX IF NOT EXISTS "passport_scan_log_recorded_at_idx"'
    );
    expect(drizzleSchema).toContain('pgTable(\n  "passport_scan_log"');
    expect(srcSchema).not.toContain("passport_scan_log");
    const parsed = JSON.parse(journal) as {
      entries: Array<{ tag: string; when: number }>;
    };
    const entry = parsed.entries.find(
      item => item.tag === "026_passport_scan_log"
    );
    expect(entry?.when).toBe(1792281600000);
    const prior = parsed.entries
      .filter(item => item.tag !== "026_passport_scan_log")
      .map(item => item.when);
    expect(entry && entry.when).toBeGreaterThan(Math.max(...prior));
  });
});
