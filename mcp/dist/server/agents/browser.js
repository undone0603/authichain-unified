import { invokeLLM, parseLLMContent } from '../_core/llm.js';
import { logActivity, getDb, enqueueTask } from '../db.js';
import { leads } from '../../drizzle/schema.js';
import { eq } from 'drizzle-orm';
// ── Config ──────────────────────────────────────────────────────────────────
const MAX_PAGE_CHARS = 8_000;
const FETCH_TIMEOUT_MS = 12_000;
const BOT_UA = 'AuthiChain-ResearchBot/1.0 (+https://authichain.com/bot)';
// ── HTML scraper ────────────────────────────────────────────────────────────
function htmlToText(html) {
    return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/&#?\w+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_PAGE_CHARS);
}
async function fetchPage(url) {
    try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
        const res = await fetch(url, {
            signal: ctl.signal,
            headers: { 'User-Agent': BOT_UA, Accept: 'text/html,application/xhtml+xml' },
            redirect: 'follow',
        });
        clearTimeout(t);
        if (!res.ok)
            return null;
        const html = await res.text();
        return { text: htmlToText(html), finalUrl: res.url };
    }
    catch {
        return null;
    }
}
async function browseLoop(startUrl, objective, maxPages = 3) {
    const visited = new Set();
    const findings = [];
    let currentUrl = startUrl;
    for (let i = 0; i < maxPages; i++) {
        if (visited.has(currentUrl))
            break;
        visited.add(currentUrl);
        const page = await fetchPage(currentUrl);
        if (!page)
            break;
        currentUrl = page.finalUrl;
        const prompt = `You are a research agent browsing the web. Your objective:
"${objective}"

Current URL: ${currentUrl}
Page content:
${page.text}

Pages visited so far: ${[...visited].join(' | ')}

1. Extract any findings relevant to the objective from this page.
2. Decide whether to navigate further (pick a link that clearly advances the objective) or stop.

Return JSON:
{
  "action": "navigate" | "done",
  "nextUrl": "<absolute URL to visit next, only if action=navigate>",
  "reason": "<one sentence>",
  "findings": "<extracted facts relevant to objective, or empty string>"
}`;
        const result = await invokeLLM({
            messages: [{ role: 'user', content: prompt }],
            responseFormat: { type: 'json_object' },
        });
        const step = parseLLMContent(result.choices[0].message.content);
        if (step.findings?.trim())
            findings.push(step.findings.trim());
        if (step.action === 'done' || !step.nextUrl)
            break;
        // Only follow same-origin or http/https absolute links
        try {
            const next = new URL(step.nextUrl);
            if (!['http:', 'https:'].includes(next.protocol))
                break;
            currentUrl = step.nextUrl;
        }
        catch {
            break;
        }
    }
    return findings.join('\n\n') || 'No findings extracted.';
}
export async function runBrowseResearchLead(task) {
    const payload = task.payload;
    const domain = payload.domain ?? payload.leadOrg.toLowerCase().replace(/\s+/g, '') + '.com';
    const startUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    const segment = payload.segment ?? 'DEFAULT';
    const objective = `Research ${payload.leadOrg} to personalize an AuthiChain sales pitch.
Find: what they sell, their supply chain challenges, any counterfeiting incidents,
recent news, team size, and technology stack hints.
Focus on angles relevant to blockchain product authentication and anti-counterfeiting.`;
    const research = await browseLoop(startUrl, objective, 4);
    // Summarise findings into a CRM note via LLM
    const summaryPrompt = `Based on this research about ${payload.leadOrg}:

${research}

Write a concise (3-5 bullet) CRM note a sales rep would want before calling them.
Focus on: what they do, why AuthiChain's anti-counterfeit/supply-chain product is relevant,
and any personalisation hooks (pain points, news, products).

Return JSON: { "summary": "...", "hookSentence": "one-sentence opener for a cold email" }`;
    const summaryResult = await invokeLLM({
        messages: [{ role: 'user', content: summaryPrompt }],
        responseFormat: { type: 'json_object' },
    });
    const { summary, hookSentence } = parseLLMContent(summaryResult.choices[0].message.content);
    // Write research back to lead record
    const db = await getDb();
    if (db) {
        await db.update(leads)
            .set({
            notes: `[browser_research]\n${summary}`,
            updatedAt: new Date(),
        })
            .where(eq(leads.email, payload.leadEmail.toLowerCase()));
    }
    // Enqueue outbound email with enriched hook
    await enqueueTask(task.missionId, 'DRAFT_OUTBOUND_EMAIL', {
        segment,
        sequence: 1,
        leadEmail: payload.leadEmail,
        leadName: payload.leadName,
        leadOrg: payload.leadOrg,
        leadTitle: payload.leadTitle,
        researchHook: hookSentence,
    });
    await logActivity({
        userId: null,
        action: 'browse_research_lead_completed',
        entityType: 'task',
        entityId: 0,
        details: {
            taskId: task.id,
            leadEmail: payload.leadEmail,
            leadOrg: payload.leadOrg,
            domain: startUrl,
            summaryLength: summary.length,
            hookSentence,
        },
    });
}
export async function runBrowseCompetitorMonitor(task) {
    const payload = task.payload;
    const focus = (payload.focusAreas ?? ['pricing', 'features', 'customers', 'partnerships']).join(', ');
    const objective = `Competitive intelligence on ${payload.competitorName} for AuthiChain sales team.
Extract: current pricing tiers, key features, customer logos/industries, recent news or product launches.
Focus areas: ${focus}.`;
    const intel = await browseLoop(payload.competitorUrl, objective, 4);
    const analysisPrompt = `AuthiChain competes with ${payload.competitorName} in blockchain product authentication.

Research findings:
${intel}

Produce a competitive brief:
1. Their pricing model (if found)
2. Top 3 features they lead on
3. Gaps AuthiChain can exploit
4. Recommended talking points against them in a sales call

Return JSON: { "pricingModel": "...", "theirStrengths": [...], "authichainEdges": [...], "talkingPoints": [...] }`;
    const analysis = await invokeLLM({
        messages: [{ role: 'user', content: analysisPrompt }],
        responseFormat: { type: 'json_object' },
    });
    const brief = parseLLMContent(analysis.choices[0].message.content);
    await logActivity({
        userId: null,
        action: 'browse_competitor_monitor_completed',
        entityType: 'automation',
        entityId: 0,
        details: {
            taskId: task.id,
            competitor: payload.competitorName,
            url: payload.competitorUrl,
            brief,
        },
    });
}
export async function runBrowseScrapeIndustryNews(task) {
    const payload = task.payload;
    const startUrl = payload.sourceUrl ?? `https://news.google.com/search?q=${encodeURIComponent(payload.keyword + ' counterfeiting supply chain')}&hl=en`;
    const objective = `Find the 3 most recent, high-impact news stories about: "${payload.keyword}".
Focus on counterfeiting, supply chain fraud, product authentication, regulatory changes.
For each story extract: headline, publication, date, brief summary, and why AuthiChain should respond to it.`;
    const raw = await browseLoop(startUrl, objective, 3);
    const extractPrompt = `From these news findings:
${raw}

Extract up to 3 actionable news stories for AuthiChain's PR team.
Return JSON: { "stories": [{ "headline": "...", "source": "...", "summary": "...", "authichainAngle": "..." }] }`;
    const result = await invokeLLM({
        messages: [{ role: 'user', content: extractPrompt }],
        responseFormat: { type: 'json_object' },
    });
    const { stories } = parseLLMContent(result.choices[0].message.content);
    if (payload.enqueueNewsTask && Array.isArray(stories) && stories.length > 0) {
        await enqueueTask(task.missionId, 'MONITOR_NEWS_FOR_PR', {
            stories,
            keyword: payload.keyword,
            source: 'browser_agent',
        });
    }
    await logActivity({
        userId: null,
        action: 'browse_scrape_news_completed',
        entityType: 'automation',
        entityId: 0,
        details: {
            taskId: task.id,
            keyword: payload.keyword,
            storiesFound: Array.isArray(stories) ? stories.length : 0,
            stories,
        },
    });
}
export async function runBrowseVerifyProductUrl(task) {
    const payload = task.payload;
    const objective = `Visit this product listing page and check whether it is a genuine AuthiChain-authenticated product.
Look for: AuthiChain QR code, authentication badge, certificate link, blockchain provenance link.
Also check: does the brand/product match "${payload.expectedBrand ?? 'the claimed brand'}"?
Flag any signs of counterfeiting (mismatched logos, poor quality descriptions, suspicious pricing).`;
    const findings = await browseLoop(payload.productUrl, objective, 2);
    const verdictPrompt = `Based on these findings about a product listing:
${findings}

Product URL: ${payload.productUrl}
Expected brand: ${payload.expectedBrand ?? 'unknown'}

Return a verification verdict.
JSON: { "verdict": "authentic|suspicious|counterfeit|inconclusive", "confidence": 0.0-1.0, "reasoning": "...", "authichainMarkerFound": boolean }`;
    const verdictResult = await invokeLLM({
        messages: [{ role: 'user', content: verdictPrompt }],
        responseFormat: { type: 'json_object' },
    });
    const verdict = parseLLMContent(verdictResult.choices[0].message.content);
    await logActivity({
        userId: null,
        action: 'browse_verify_product_completed',
        entityType: 'automation',
        entityId: 0,
        details: {
            taskId: task.id,
            productUrl: payload.productUrl,
            productId: payload.productId,
            ...verdict,
        },
    });
}
