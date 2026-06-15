import { invokeLLM, parseLLMContent } from '../_core/llm.js';
import { logActivity, markTaskWaitingHuman } from '../db.js';
import { postThread } from '../twitter-service.js';
import { postLinkedInThread } from '../linkedin-service.js';
import { ENV } from '../_core/env.js';
import type { MissionTask as Task } from '../../drizzle/schema.js';

interface ContentPayload {
  audience?: string;
  scope?: string;
  platforms?: string[];
}

export async function runGenerateLaunchChecklist(task: Task): Promise<void> {
  const payload = task.payload as ContentPayload;
  const scope = payload.scope ?? 'full_launch';

  const prompt = `Create a comprehensive launch checklist for AuthiChain (authichain.com), scope: ${scope}.

Categories:
- Technical readiness (infra, SSL, monitoring, backups)
- Product readiness (features complete, QA done, docs live)
- Marketing readiness (press release, social content, email campaign)
- Sales readiness (CRM set up, outreach sequences queued)
- Legal/compliance (ToS, Privacy Policy, GDPR)
- Launch day (countdown steps, go/no-go criteria)
- Post-launch (monitoring, support coverage, feedback loops)

Return JSON: { "title": "...", "categories": [{ "name": "...", "items": [{ "task": "...", "owner": "...", "done": false }] }] }`;

  const result = await invokeLLM({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  const checklist = parseLLMContent<unknown>(result.choices[0].message.content);

  await logActivity({ userId: null, action: 'launch_checklist_generated', entityType: 'task', entityId: 0, details: { taskId: task.id,
    scope,
    missionId: task.missionId,
  }});
}

export async function runDraftLaunchEmail(task: Task): Promise<void> {
  const payload = task.payload as ContentPayload;
  const audience = payload.audience ?? 'founders';

  const prompt = `Write a launch announcement email for AuthiChain (authichain.com).

Audience: ${audience}
AuthiChain is a blockchain-backed product authentication platform — QR codes, AI analysis, NFT certificates of authenticity.

Write an engaging, founder-voiced launch email (300-400 words) covering:
1. The problem (counterfeiting costs brands billions)
2. The AuthiChain solution
3. Key features (3 bullets)
4. Call to action (sign up / schedule demo)
5. P.S. with a personal note

Return JSON: { "subject": "...", "body": "..." }`;

  const result = await invokeLLM({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  const email = parseLLMContent<{ subject: string; body: string }>(result.choices[0].message.content);

  await logActivity({ userId: null, action: 'launch_email_drafted', entityType: 'task', entityId: 0, details: { taskId: task.id,
    audience,
    subject: email.subject,
    missionId: task.missionId,
  }});
}

export async function runDraftPressRelease(task: Task): Promise<void> {
  const prompt = `Write a press release announcing the launch of AuthiChain (authichain.com).

AuthiChain enables brands and distributors to authenticate products using blockchain-backed QR codes and AI-powered counterfeit detection. Key features: instant QR scan authentication, NFT certificates of authenticity, AI confidence scoring, tamper-evident provenance trail.

Follow standard press release format:
- FOR IMMEDIATE RELEASE
- Headline
- Subheadline
- Dateline + lead paragraph
- 2-3 body paragraphs (problem → solution → market opportunity)
- Quote from a fictional founder ("John Carter, CEO of AuthiChain")
- About AuthiChain boilerplate
- Contact information placeholder

Return JSON: { "headline": "...", "subheadline": "...", "body": "...", "quote": "...", "boilerplate": "..." }`;

  const result = await invokeLLM({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  const pr = parseLLMContent<unknown>(result.choices[0].message.content);

  await logActivity({ userId: null, action: 'press_release_drafted', entityType: 'task', entityId: 0, details: { taskId: task.id,
    missionId: task.missionId,
  }});
}

export async function runScheduleSocialPosts(task: Task): Promise<void> {
  const payload = task.payload as ContentPayload;
  const platforms = payload.platforms ?? ['twitter', 'linkedin'];

  const prompt = `Create a social media launch content calendar for AuthiChain (authichain.com).

Platforms: ${platforms.join(', ')}
Timeline: launch week (7 days)

For each platform, write 5-7 posts covering:
- Teaser (2 days before launch)
- Launch day announcement
- Feature spotlight (1 per key feature)
- Social proof / early adopter call
- Engagement post (question for audience)

Return JSON: { "platforms": { "<platform>": [{ "day": 0, "copy": "...", "hashtags": ["..."] }] } }`;

  const result = await invokeLLM({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  const calendar = parseLLMContent<{ platforms?: Record<string, { day: number; copy: string; hashtags: string[] }[]> }>(result.choices[0].message.content);

  // ─── Approval gate ──────────────────────────────────────────────────────
  // Social posts publish to live accounts (Twitter, LinkedIn) — when the
  // outreach-approval flag is on, persist the generated calendar to the
  // activity log and pause the task. An approver re-runs in unattended mode
  // (per-batch) to publish.
  if (ENV.requireOutreachApproval) {
    await logActivity({
      userId: null,
      action: 'social_posts_pending_approval',
      entityType: 'task',
      entityId: 0,
      details: {
        taskId: task.id,
        missionId: task.missionId,
        platforms,
        calendar,
        totalScheduled: Object.values(calendar.platforms ?? {}).reduce((s, arr) => s + arr.length, 0),
      },
    });
    await markTaskWaitingHuman(task.id);
    return;
  }

  const postedUrls: string[] = [];

  // Build today's (day 0) posts per platform, then fire in parallel
  const twitterPosts  = (calendar.platforms?.['twitter'] ?? calendar.platforms?.['x'] ?? []).filter(p => p.day === 0);
  const linkedinPosts = (calendar.platforms?.['linkedin'] ?? []).filter(p => p.day === 0);

  const formatText = (post: { copy: string; hashtags?: string[] }, maxLen = 0): string => {
    const tagged = post.hashtags?.length
      ? `${post.copy}\n\n${post.hashtags.map(h => `#${h.replace(/^#/, '')}`).join(' ')}`
      : post.copy;
    return maxLen && tagged.length > maxLen ? tagged.slice(0, maxLen - 3) + '…' : tagged;
  };

  const [twitterResults, linkedinResults] = await Promise.allSettled([
    // Twitter/X — 280 char limit, real thread support
    (async () => {
      if (!(platforms.includes('twitter') || platforms.includes('x')) || twitterPosts.length === 0) return [];
      const texts = twitterPosts.map(p => formatText(p, 280));
      const tweets = await postThread(texts, 'authichain');
      return tweets.map(t => t?.url ?? '').filter(Boolean);
    })(),

    // LinkedIn — 3000 char limit, sequential posts
    (async () => {
      if (!platforms.includes('linkedin') || linkedinPosts.length === 0) return [];
      const texts = linkedinPosts.map(p => formatText(p, 3000));
      const posts = await postLinkedInThread(texts, 'person');
      return posts.map(p => p.postUrl).filter(Boolean);
    })(),
  ]);

  if (twitterResults.status === 'fulfilled')  postedUrls.push(...twitterResults.value);
  else console.warn('[content.ts] Twitter post failed:', twitterResults.reason);

  if (linkedinResults.status === 'fulfilled') postedUrls.push(...linkedinResults.value);
  else console.warn('[content.ts] LinkedIn post failed:', linkedinResults.reason);

  await logActivity({ userId: null, action: 'social_posts_scheduled', entityType: 'task', entityId: 0, details: {
    taskId: task.id,
    platforms,
    missionId: task.missionId,
    postedUrls,
    totalScheduled: Object.values(calendar.platforms ?? {}).reduce((s, arr) => s + arr.length, 0),
  }});
}
