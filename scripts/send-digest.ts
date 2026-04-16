// scripts/send-digest.ts
import { createClient } from '@supabase/supabase-js';

const isDryRun = process.env.DRY_RUN === 'true';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const GOVCHAIN = process.env.GOVCHAIN_URL ?? 'https://govchain.us';

// Skip gracefully if Slack isn't configured. Digest is a nice-to-have —
// failing this step marks the whole pipeline red even when ingest/score/
// propose all succeeded, so missing Slack creds degrade to a warning.
if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHANNEL_ID) {
  console.warn('⚠️  Slack not configured (SLACK_BOT_TOKEN / SLACK_CHANNEL_ID missing) — skipping digest.');
  process.exit(0);
}

async function sendSlackDigest() {
  const { data: topOpps } = await supabase
    .from('gov_proposals')
    .select('*')
    .gte('fit_score', 65)
    .order('fit_score', { ascending: false })
    .limit(5);

  const { count: totalIngested } = await supabase
    .from('gov_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('ingested_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const { count: totalDrafted } = await supabase
    .from('gov_proposals')
    .select('*', { count: 'exact', head: true })
    .gte('generated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const oppLines = (topOpps ?? [])
    .map((o, i) => `>${i + 1}. *[${o.fit_score}/100]* <${o.sam_url}|${o.title?.slice(0, 55)}> — ${o.agency?.slice(0, 30)} | Deadline: ${o.deadline ?? 'TBD'}`)
    .join('\n');

  const payload = {
    channel: process.env.SLACK_CHANNEL_ID!,
    text: '📡 GovChain Daily Lead-Gen Digest',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '📡 GovChain Daily Lead-Gen Digest', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Opportunities Ingested*\n${totalIngested ?? 0}` },
          { type: 'mrkdwn', text: `*Proposals Drafted*\n${totalDrafted ?? 0}` },
        ],
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*🏆 Top Opportunities Today*\n${oppLines || '_No high-fit opportunities today._'}` },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '🌐 View GovChain Dashboard', emoji: true },
            url: `${GOVCHAIN}/dashboard`,
            style: 'primary',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '📋 All Proposals', emoji: true },
            url: `${GOVCHAIN}/proposals`,
          },
        ],
      },
    ],
  };

  if (!isDryRun) {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(`Slack error: ${json.error}`);
    console.log('✅ Slack digest sent');
  } else {
    console.log('[DRY RUN] Slack digest payload:', JSON.stringify(payload, null, 2));
  }
}

await sendSlackDigest();
process.exit(0);
