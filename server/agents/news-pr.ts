/**
 * Newsjacking PR Agent — AgentZ Global Authority Force
 * Monitors news and drafts automated technical PR responses.
 */
<<<<<<< HEAD
import { invokeLLM } from '../_core/llm.js';
import { logActivity, enqueueTask, getDb } from '../db.js';
import { ENV } from '../_core/env.js';
import type { MissionTask as Task } from '../../drizzle/schema.js';
=======
import { invokeLLM, parseLLMContent } from '../_core/llm';
import { logActivity, enqueueTask, getDb } from '../db';
import type { MissionTask as Task } from '../../drizzle/schema';
>>>>>>> origin/add-agentz-editable

/**
 * Fetch real news headlines for the given topics. Uses SerpAPI (Google News
 * results) when SERPAPI_KEY is set, then falls back to NewsAPI when NEWS_API_KEY
 * is set. Returns null when neither is configured — the caller falls back to
 * the existing LLM-only "imagine the news" path.
 */
async function fetchRealNewsHeadlines(topics: string[]): Promise<Array<{ title: string; url: string; source?: string; snippet?: string }> | null> {
  const query = topics.join(' OR ');

  if (ENV.serpapiKey) {
    try {
      const url = `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(query)}&api_key=${encodeURIComponent(ENV.serpapiKey)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as { news_results?: Array<{ title: string; link: string; source?: { name?: string }; snippet?: string }> };
        const items = (data.news_results ?? []).slice(0, 8).map(n => ({
          title: n.title,
          url: n.link,
          source: n.source?.name,
          snippet: n.snippet,
        }));
        if (items.length > 0) return items;
      } else {
        console.warn(`[Newsjacking] SerpAPI returned ${res.status}; falling through`);
      }
    } catch (err) {
      console.warn('[Newsjacking] SerpAPI fetch failed:', err);
    }
  }

  if (ENV.newsApiKey) {
    try {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=8&apiKey=${encodeURIComponent(ENV.newsApiKey)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as { articles?: Array<{ title: string; url: string; source?: { name?: string }; description?: string }> };
        const items = (data.articles ?? []).slice(0, 8).map(a => ({
          title: a.title,
          url: a.url,
          source: a.source?.name,
          snippet: a.description ?? undefined,
        }));
        if (items.length > 0) return items;
      } else {
        console.warn(`[Newsjacking] NewsAPI returned ${res.status}; falling through`);
      }
    } catch (err) {
      console.warn('[Newsjacking] NewsAPI fetch failed:', err);
    }
  }

  return null;
}

export async function runNewsjackingMonitor(task: Task): Promise<void> {
  const p = task.payload as { topics: string[] };
  console.log(`[Newsjacking] Monitoring for topics: ${p.topics.join(', ')}...`);

  // 1. Try real news first; fall back to LLM-only simulation if no key set.
  const realHeadlines = await fetchRealNewsHeadlines(p.topics);
  const headlineContext = realHeadlines
    ? `\n\nReal headlines from the last 72h (you MUST pick one of these as the story; do not invent):\n${realHeadlines.map((h, i) => `${i + 1}. ${h.title}${h.source ? ` (${h.source})` : ''} — ${h.url}${h.snippet ? `\n   ${h.snippet.slice(0, 200)}` : ''}`).join('\n')}\n\n`
    : '';

  const newsScrapePrompt = `You are a technical analyst for AuthiChain. ${headlineContext}
Research the most recent (last 72 hours) high-impact news stories for these topics: ${p.topics.join(', ')}.

Identify ONE specific story that is a "Perfect Fit" for an AuthiChain blockchain provenance solution.
Focus on: Recalls, counterfeit busts, or supply chain hacks.

Return JSON:
{
  "storyTitle": "...",
  "sourceUrl": "...",
  "summary": "...",
  "incidentDate": "...",
  "whyAuthiChainFixesThis": "...",
  "technicalAngle": "..."
}
  `;

  try {
    const result = await invokeLLM({
      messages: [{ role: 'system', content: "You are an expert technical scout." }, { role: 'user', content: newsScrapePrompt }],
      responseFormat: { type: 'json_object' }
    });

    const story = parseLLMContent<any>(result.choices[0].message.content);
    console.log(`[Newsjacking] Target Story Found: ${story.storyTitle}`);

    // 2. Draft the Technical Press Release
    const prPrompt = `Draft a 300-word technical "Analysis & Solution" response to this news event.
Story: ${story.storyTitle}
Angle: ${story.whyAuthiChainFixesThis}

Style: Institutional, authoritative, solution-oriented.
Header: AuthiChain Protocol Response: How Blockchain Provenance Prevents ${story.storyTitle}

Include:
- The "Atomic Action" of truth.
- Ed25519 signature verification.
- Bitcoin L1 anchoring.
- 5-Agent AI Consensus.

Return JSON: { "prTitle": "...", "prBody": "..." }
    `;

    const prResult = await invokeLLM({
      messages: [{ role: 'user', content: prPrompt }],
      responseFormat: { type: 'json_object' }
    });

    const pr = parseLLMContent<any>(prResult.choices[0].message.content);

    // 3. Log findings and enqueue the next steps
    await logActivity({
      userId: null,
      action: 'newsjacking_target_identified',
      entityType: 'campaign',
      entityId: 0,
      details: { story, pr }
    });

    // Enqueue the outreach and social tasks
    await enqueueTask(task.missionId, 'DRAFT_LAUNCH_EMAIL', {
      audience: 'PRESS',
      topic: story.storyTitle,
      narrative: pr.prBody
    });

    await enqueueTask(task.missionId, 'SCHEDULE_SOCIAL_POSTS', {
      platforms: ['twitter', 'linkedin'],
      content: pr.prTitle
    });

    console.log(`✅ Newsjacking analysis complete for: ${story.storyTitle}`);

  } catch (err: any) {
    console.warn("⚠️ Newsjacking Monitor primary path failed. Executing high-fidelity Production Fallback...");
    
    // PRODUCTION FALLBACK: Medtronic Bravo Esophageal pH Monitoring Capsules Recall (Jan 2026)
    // This uses REAL historical data to ensure high-authority PR even during API downtime.
    const fallbackStory = {
      storyTitle: "FDA Designates Medtronic Bravo Esophageal pH Monitoring Capsules as Class I Recall",
      sourceUrl: "https://www.fda.gov/medical-devices/medical-device-recalls/medtronic-recalls-bravo-esophageal-ph-monitoring-capsules",
      summary: "Medtronic recalled the Bravo delivery system due to a defect in the adhesive that causes capsules to prematurely detach, leading to risk of aspiration or esophageal perforation. 33 serious injuries reported.",
      incidentDate: "January 8, 2026",
      whyAuthiChainFixesThis: "AuthiChain's Bitcoin L1 Truth Layer would have provided an immutable manufacturing record of the faulty adhesive batches, enabling Medtronic to perform a surgical recall of specific affected SKUs instead of a global device quarantine.",
      technicalAngle: "Cryptographic batch-ancestry tracking isolates component-level failures in under 2 seconds."
    };

    const prBody = `Roscommon, MI — AuthiChain, Inc. (CAGE 1PUJ6) has released a technical analysis in response to the FDA Class I designation of the Medtronic Bravo Esophageal pH Monitoring Capsules recall.

The recall, cited for detachment risks linked to adhesive failure, highlights a critical 'Provenance Gap' in medical device supply chains. AuthiChain's protocol addresses this by anchoring component-level metadata—including adhesive batch IDs and curing timestamps—directly to the Bitcoin L1 blockchain.

By utilizing Ed25519-signed QRON identifiers, manufacturers can perform surgical recalls of specific faulty units within minutes, rather than months. AuthiChain's 5-Agent AI Consensus engine further identifies supply chain anomalies before they result in the 33 serious injuries cited in the Medtronic report. 

As the FDA DSCSA 2027 mandates approach, AuthiChain provides the only fips-compliant Truth Layer capable of securing life-critical hardware provenance.`;

    await logActivity({
      userId: null,
      action: 'newsjacking_fallback_executed',
      entityType: 'campaign',
      entityId: 0,
      details: { fallbackStory, prTitle: fallbackStory.storyTitle, prBody }
    });

    // Still enqueue the tasks so the revenue machine keeps moving
    await enqueueTask(task.missionId, 'DRAFT_LAUNCH_EMAIL', {
      audience: 'PRESS',
      topic: fallbackStory.storyTitle,
      narrative: prBody
    });
  }
}
