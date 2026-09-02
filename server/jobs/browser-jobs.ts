import { logActivity, hasActionLogged } from '../db.js';
import {
  runBrowseCompetitorMonitor,
  runBrowseScrapeIndustryNews,
  type BrowseCompetitorPayload,
  type BrowseNewsPayload,
} from '../agents/browser.js';
import type { MissionTask as Task } from '../../drizzle/schema.js';

type BrowserTaskPayload = BrowseCompetitorPayload | BrowseNewsPayload;

function createSyntheticTask(payload: BrowserTaskPayload): Task {
  return {
    id: "synthetic-browser-task",
    missionId: "synthetic-browser-mission",
    kind: "BROWSER_JOB",
    title: "Synthetic browser task",
    description: null,
    status: "pending",
    priority: 0,
    order: 0,
    payload,
    result: null,
    error: null,
    scheduledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Competitors to monitor weekly
const COMPETITORS: BrowseCompetitorPayload[] = [
  { competitorName: 'Legitify',  competitorUrl: 'https://legitify.com',  focusAreas: ['pricing', 'features'] },
  { competitorName: 'Authentix', competitorUrl: 'https://authentix.com', focusAreas: ['pricing', 'customers'] },
  { competitorName: 'Qliktag',   competitorUrl: 'https://qliktag.com',   focusAreas: ['features', 'partnerships'] },
];

// Industry news keywords to monitor — throttled to once per day each
const NEWS_KEYWORDS: string[] = [
  'product counterfeiting supply chain 2026',
  'FDA DSCSA compliance 2026',
  'luxury goods authentication blockchain',
  'medical device counterfeit recall',
];

export async function runBrowserAgentJobs(): Promise<{
  competitorsChecked: number;
  newsKeywordsScanned: number;
  skipped: number;
}> {
  let competitorsChecked = 0;
  let newsKeywordsScanned = 0;
  let skipped = 0;

  // ── Weekly competitor monitoring ──────────────────────────────────────────
  // Gate the whole batch — if any competitor was checked this week, skip all.
  // This prevents re-running the batch mid-week on subsequent ticks.
  const batchRanThisWeek = await hasActionLogged('browse_competitor_monitor_completed', 7);
  if (batchRanThisWeek) {
    skipped += COMPETITORS.length;
  } else {
    for (const competitor of COMPETITORS) {
      try {
        const fakeTask = createSyntheticTask(competitor);
        await runBrowseCompetitorMonitor(fakeTask);
        competitorsChecked++;
      } catch (err) {
        await logActivity({
          userId: null,
          action: 'browser_jobs_competitor_error',
          entityType: 'automation',
          entityId: 0,
          details: { competitor: competitor.competitorName, error: String(err) },
        });
      }
    }
  }

  // ── Daily news scan ───────────────────────────────────────────────────────
  // Gate: skip each keyword if it was scanned in the last 24 hours.
  for (const keyword of NEWS_KEYWORDS) {
    const ranToday = await hasActionLogged('browse_scrape_news_completed', 1);
    if (ranToday) { skipped++; continue; }

    try {
      const payload: BrowseNewsPayload = { keyword, enqueueNewsTask: true };
      const fakeTask = createSyntheticTask(payload);
      await runBrowseScrapeIndustryNews(fakeTask);
      newsKeywordsScanned++;
    } catch (err) {
      await logActivity({
        userId: null,
        action: 'browser_jobs_news_error',
        entityType: 'automation',
        entityId: 0,
        details: { keyword, error: String(err) },
      });
    }
  }

  return { competitorsChecked, newsKeywordsScanned, skipped };
}
