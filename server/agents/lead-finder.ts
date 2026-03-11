import { invokeLLM } from '../_core/llm.js';
import { callDataApi } from '../_core/dataApi.js';
import { logActivity, enqueueTask } from '../db.js';
import type { MissionTask as Task } from '../../drizzle/schema.js';
import { getDb } from '../db.js';
import { leads } from '../../drizzle/schema.js';

interface LeadFinderPayload {
  count?: number;
  icp?: string;
  vertical?: string;
  segment?: string;
}

interface FoundLead {
  name: string;
  org: string;
  email: string;
  title?: string;
  notes?: string;
}

interface SearchResult {
  title?: string;
  snippet?: string;
  link?: string;
}

interface SearchResponse {
  organic?: SearchResult[];
}

function buildSearchQueries(segment: string, icp: string, vertical?: string): string[] {
  const base = vertical ? `${icp} ${vertical}` : icp;
  return [
    `"${base}" procurement officer contact email`,
    `site:linkedin.com "${base}" director manager`,
    `"${base}" decision maker contact 2024`,
  ];
}

async function fetchSearchResults(query: string): Promise<SearchResult[]> {
  try {
    const data = await callDataApi('Google/search', { query: { q: query, num: 10 } }) as SearchResponse;
    return data?.organic ?? [];
  } catch {
    return [];
  }
}

export async function runLeadFinder(task: Task): Promise<void> {
  const payload = task.payload as LeadFinderPayload;
  const segment = payload.segment ?? (task.kind === 'FIND_GOV_LEADS' ? 'GOV' : 'RETAIL');
  const count = payload.count ?? 10;
  const icp = payload.icp ?? (segment === 'GOV' ? 'government agency supply chain procurement' : 'retail dispensary owner');

  // Collect search results from multiple queries
  const queries = buildSearchQueries(segment, icp, payload.vertical);
  const allResults: SearchResult[] = [];
  for (const q of queries) {
    const results = await fetchSearchResults(q);
    allResults.push(...results);
    if (allResults.length >= 20) break;
  }

  const searchContext = allResults
    .slice(0, 20)
    .map(r => `Title: ${r.title ?? ''}\nSnippet: ${r.snippet ?? ''}\nURL: ${r.link ?? ''}`)
    .join('\n---\n');

  const prompt = `You are a B2B lead researcher. Using the web search results below, extract up to ${count} real decision-maker contacts for:

ICP: ${icp}
Segment: ${segment}
${payload.vertical ? `Vertical: ${payload.vertical}` : ''}

Web search results:
${searchContext || '(no results — use your knowledge of this industry)'}

For each lead, produce:
- name: full name of decision-maker
- org: organization name
- email: best-guess professional email (firstname.lastname@domain.com or info@domain.com)
- title: job title
- notes: 1-sentence fit reason

Return JSON: { "leads": [ { "name":"...", "org":"...", "email":"...", "title":"...", "notes":"..." } ] }`;

  const result = await invokeLLM({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  let foundLeads: FoundLead[] = [];
  try {
    const content = result.choices[0].message.content as string;
    const parsed = JSON.parse(content ?? '{}');
    foundLeads = Array.isArray(parsed) ? parsed : (parsed.leads ?? []);
  } catch {
    throw new Error(`Lead finder LLM returned unparseable JSON: ${(result.choices[0].message.content as string)?.slice(0, 200)}`);
  }

  const db = await getDb();
  let inserted = 0;

  for (const lead of foundLeads) {
    if (!lead.email || !lead.org) continue;

    if (db) {
      await db.insert(leads).values({
        email: lead.email.toLowerCase(),
        name: lead.name,
        company: lead.org,
        title: lead.title,
        notes: lead.notes,
        source: `agentz_lead_finder_${segment.toLowerCase()}`,
        status: 'new',
        segment,
      }).onConflictDoNothing();
    }

    await enqueueTask(task.missionId, 'DRAFT_OUTBOUND_EMAIL', {
      segment,
      sequence: 1,
      leadEmail: lead.email,
      leadName: lead.name,
      leadOrg: lead.org,
      leadTitle: lead.title,
    });

    inserted++;
  }

  await logActivity({ userId: null, action: 'lead_finder_completed', entityType: 'task', entityId: 0, details: { taskId: task.id,
    segment,
    found: foundLeads.length,
    inserted,
    searchResultsUsed: allResults.length,
    missionId: task.missionId,
  }});
}
