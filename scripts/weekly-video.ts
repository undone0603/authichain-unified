// scripts/weekly-video.ts
// Produces one informational video per week for the QRON YouTube channel.
//
//   Script -> HeyGen render -> YouTube upload -> logged in Supabase
//
// qron.space needs no redeploy: it reads the channel's public RSS feed, so an
// upload appears on the site within the feed's cache window.
//
// Usage:
//   DRY_RUN=true pnpm exec tsx scripts/weekly-video.ts      # script only
//   TOPIC="EU DPP basics" pnpm exec tsx scripts/weekly-video.ts

import { createClient } from '@supabase/supabase-js';

const isDryRun   = process.env.DRY_RUN === 'true';
const publishOk  = process.env.PUBLISH_OK !== 'false';
const CHANNEL_ID = process.env.YOUTUBE_QRON_CHANNEL_ID ?? 'UCCm-myVgS90meDtrAtAuLqw';

// Evergreen rotation tied to the compliance deadlines that drive demand
// (CMMC Nov 2026, EU DPP 2027). Ordered roughly by search intent.
const TOPICS = [
  { slug: 'what-is-a-digital-product-passport', title: 'What Is a Digital Product Passport? (EU DPP Explained in 90 Seconds)',
    angle: 'Define the DPP, who it binds, the 2027 enforcement dates, and the data fields every passport must carry.' },
  { slug: 'cmmc-2-supply-chain-gap', title: 'The CMMC 2.0 Supply-Chain Gap Most Contractors Miss',
    angle: 'A perfect SPRS score still leaves subcontractor CUI custody unproven. Show the gap and how provenance closes it.' },
  { slug: 'verify-a-product-in-2-seconds', title: 'Verify Any Product in Under 2 Seconds (Live QR Demo)',
    angle: 'Scan a QR, resolve the on-chain record, show the Ed25519 seal and full chain of custody.' },
  { slug: 'coa-hashing-for-cannabis', title: 'COA Hashing: Making Lab Results Tamper-Evident',
    angle: 'Why a PDF certificate proves nothing, and how hashing plus METRC sync makes tampering detectable.' },
  { slug: 'anti-counterfeit-economics', title: 'The Real Cost of Counterfeits (And What Verification Saves)',
    angle: 'Quantify counterfeit loss, then show the per-scan cost of verification against it.' },
  { slug: 'blockchain-without-the-hype', title: 'Blockchain Provenance Without the Hype',
    angle: 'Exactly which parts belong on-chain versus off-chain, and why anchoring beats storing.' },
  { slug: 'espr-delegated-acts-timeline', title: 'ESPR Delegated Acts: Your 2027 Compliance Timeline',
    angle: 'Battery Feb 2027, textile and cannabis Q2 2027 — what to have in place, and by when.' },
  { slug: 'sprs-110-what-next', title: 'You Scored 110 on SPRS. What Now?',
    angle: 'Post-certification posture: continuous monitoring and supplier attestation.' },
];

function supa() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  return url && key ? createClient(url, key) : null;
}

// Pick the topic least recently published so the rotation never repeats while
// unused topics remain. Falls back to week-of-year when Supabase is absent.
async function pickTopic(): Promise<typeof TOPICS[0]> {
  const explicit = process.env.TOPIC?.trim();
  if (explicit) {
    const match = TOPICS.find(t => t.slug === explicit || t.title.toLowerCase().includes(explicit.toLowerCase()));
    if (match) return match;
    return { slug: explicit.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title: explicit, angle: explicit };
  }

  const db = supa();
  if (!db) {
    const week = Math.floor(Date.now() / 6048e5);
    return TOPICS[week % TOPICS.length];
  }

  const { data } = await db.from('video_log').select('slug').order('created_at', { ascending: false }).limit(100);
  const used = new Set((data ?? []).map((r: any) => r.slug));
  return TOPICS.find(t => !used.has(t.slug)) ?? TOPICS[used.size % TOPICS.length];
}

function buildScript(topic: typeof TOPICS[0]): string {
  return [
    `${topic.title}.`,
    '',
    topic.angle,
    '',
    'Here is what matters. Regulators are moving from paper attestations to machine-verifiable records.',
    'That means every unit needs a provenance trail a scanner can check in seconds — not a PDF in a shared drive.',
    '',
    'AuthiChain anchors each record on Polygon with an Ed25519 signature, so tampering is detectable and',
    'verification is instant. No integration required to see it working.',
    '',
    'Scan any QRON code, or start a sandbox at qron dot space. Links are in the description.',
  ].join('\n');
}

async function main() {
  const topic = await pickTopic();
  const script = buildScript(topic);

  console.log(`\n🎬 WEEKLY VIDEO — ${topic.title}`);
  console.log('─'.repeat(60));
  console.log(script);
  console.log('─'.repeat(60));

  if (isDryRun || !publishOk) {
    console.log(`\n✅ Script generated. ${isDryRun ? 'DRY_RUN=true' : 'Publishing secrets missing'} — no render or upload.`);
    console.log(`   Channel: https://www.youtube.com/channel/${CHANNEL_ID}`);
    return;
  }

  // Render + upload run through the existing service layer so credential
  // handling and retries live in one place.
  const { renderHeygenVideo } = await import('../server/agents/heygen-video.js').catch(() => ({ renderHeygenVideo: null as any }));
  const { uploadVideo } = await import('../server/youtube-service.js');

  if (!renderHeygenVideo) {
    console.error('::error::server/agents/heygen-video.ts does not export renderHeygenVideo — cannot render.');
    process.exit(1);
  }

  console.log('\n🎥 Rendering via HeyGen…');
  const videoUrl: string = await renderHeygenVideo({ script, title: topic.title });

  console.log('📤 Uploading to YouTube…');
  const { videoId, youtubeUrl } = await uploadVideo({
    videoUrl,
    title: topic.title,
    description: [
      topic.angle,
      '',
      'Try it free: https://qron.space',
      'Book a walkthrough: https://app.authichain.com/book',
      '',
      '#DigitalProductPassport #CMMC #SupplyChain #Blockchain',
    ].join('\n'),
    tags: ['digital product passport', 'CMMC', 'supply chain', 'blockchain', 'provenance'],
    category: '28', // Science & Technology
    channel: 'qron',
  } as any);

  console.log(`✅ Published: ${youtubeUrl}`);

  const db = supa();
  if (db) {
    await db.from('video_log').insert({
      slug: topic.slug, title: topic.title, video_id: videoId,
      youtube_url: youtubeUrl, channel: 'qron', created_at: new Date().toISOString(),
    });
    console.log('📋 Logged to video_log — this topic will not repeat.');
  }
}

main().catch((err) => {
  console.error(`::error::Weekly video failed: ${err?.message ?? err}`);
  process.exit(1);
});
