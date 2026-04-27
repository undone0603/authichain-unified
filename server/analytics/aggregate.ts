// Pure aggregation logic for authentications-as-scans analytics.
// Lifted from authichain (Next.js) sibling: app/api/analytics/route.ts
// Adapted: 'scans'→'authentications', 'scan_result'→'result', and
// the unified 'result' enum has 3 values ('authentic'|'counterfeit'|'uncertain'),
// where the source had only 2.

export type AuthRow = {
  result: string;
  createdAt: Date | string;
};

export type DailyTrend = {
  date: string;
  scans: number;
  authentic: number;
  counterfeit: number;
};

export type AnalyticsResult = {
  stats: {
    totalScans: number;
    counterfeitRate: number;
    authenticScans: number;
    counterfeitScans: number;
  };
  dailyTrends: DailyTrend[];
};

function toIsoDate(value: Date | string): string {
  return (typeof value === "string" ? new Date(value) : value).toISOString().split("T")[0];
}

export function aggregateAuthentications(
  rows: AuthRow[],
  now: Date = new Date(),
): AnalyticsResult {
  const totalScans = rows.length;
  const counterfeits = rows.filter((r) => r.result === "counterfeit").length;
  const authentic = rows.filter((r) => r.result === "authentic").length;
  const counterfeitRate = totalScans > 0 ? Math.round((counterfeits / totalScans) * 100) : 0;

  const last7Days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    last7Days.push(d.toISOString().split("T")[0]);
  }

  const dailyTrends: DailyTrend[] = last7Days.map((isoDate) => {
    const dayRows = rows.filter((r) => toIsoDate(r.createdAt) === isoDate);
    return {
      date: new Date(isoDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      scans: dayRows.length,
      authentic: dayRows.filter((r) => r.result === "authentic").length,
      counterfeit: dayRows.filter((r) => r.result === "counterfeit").length,
    };
  });

  return {
    stats: {
      totalScans,
      counterfeitRate,
      authenticScans: authentic,
      counterfeitScans: counterfeits,
    },
    dailyTrends,
  };
}
