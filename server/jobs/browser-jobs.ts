import { logActivity, getDb } from '../db.js';
import {
  runBrowseCompetitorMonitor,
  runBrowseScrapeIndustryNews,
  type BrowseCompetitorPayload,
  type BrowseNewsPayload,
} from '../agents/browser.js';
import { missionTasks } from '../../drizzle/schema.js';
import { and, eq, gte, sql } from 'drizzle-orm';

// Competitors to monitor weekly
const COMPETITORS: BrowseCompetitorPayload[] = [
  { competitorName: 'Legitify',    competitorUrl: 'https://legitify.com',   focusAreas: ['pricing', 'features'] },
  { competitorName: 'Authentix',   competitorUrl: 'https://authentix.com',  focusAreas: ['pricing', 'customers'] },
  { competitorName: 'Qliktag',     competitorUrl: 'https://qliktag.com',    focusAreas: ['features', 'partnerships'] },
];

// Industry news keywords to monitor each tick
const NEWS_KEYWORDS: string[] = [
  'product counterfeiting supply chain 2026',
  'FDA DSCSA compliance 2026',
  'luxury goods authentication blockchain',
  'medical device counterfeit recall',
];

// Only run each browser job once per 7 days (prevent redundant API calls across ticks)
async function hasRunRecently(jobKey: string, withinHours = 168): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  const rows = await db
    .select({ id: missionTasks.id })
    .from(missionTasks)
    .where(
      and(
        eq(missionTasks.kind, 'BROWSE_COMPETITOR_MONITOR'),
        gte(missionTasks.createdAt, since),
        sql`${missionTasks.payload}::text LIKE ${`%${jobKey}%`}`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function runBrowserAgentJobs(): Promise<{
  competitorsChecked: number;
  newsKeywordsScanned: number;
  skipped: number;
}> {
  let competitorsChecked = 0;
  let newsKeywordsScanned = 0;
  let skipped = 0;

  // ── Weekly competitor monitoring ─────────────────────────────────────────
  for (const competitor of COMPETITORS) {
    const alreadyRan = await hasRunRecently(competitor.competitorName);
    if (alreadyRan) { skipped++; continue; }

    try {
      // Run inline (not via task queue) so results are available this tick
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

  // ── News keyword scan (every tick, lightweight) ─────────────────────────
  for (const keyword of NEWS_KEYWORDS) {
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
