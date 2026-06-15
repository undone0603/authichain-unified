import { logActivity, hasActionLogged } from '../db';
import {
  runBrowseCompetitorMonitor,
  runBrowseScrapeIndustryNews,
  type BrowseCompetitorPayload,
  type BrowseNewsPayload,
} from '../agents/browser';

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
        const fakeTask = { id: 0, missionId: 0, payload: competitor } as any;
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
      const fakeTask = { id: 0, missionId: 0, payload } as any;
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
