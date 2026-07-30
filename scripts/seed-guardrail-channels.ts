// scripts/seed-guardrail-channels.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const CHANNELS: Array<{ name: string; category: string; daily_cap: number; description: string }> = [
  { name: 'email.qron-drip', category: 'email', daily_cap: 25, description: 'Supabase pg_cron qron-drip-sequence — not yet integrated with this guardrail; seeded disabled as a placeholder for when it is.' },
  { name: 'email.b2b-cold', category: 'email', daily_cap: 25, description: 'scripts/b2b-cold-outreach.ts weekly cold outreach — integrated with this guardrail (check/record on every send). Seeded disabled; flip on when ready to actually send.' },
  { name: 'content.publish', category: 'content', daily_cap: 10, description: 'SEO/content page publishing (sub-project 3, not yet built).' },
  { name: 'licensing.docusign', category: 'contract', daily_cap: 5, description: 'licensing_closer contract-value actions (DocuSign envelopes, setup-fee links) — not yet integrated with this guardrail.' },
  { name: 'partnership.outreach', category: 'email', daily_cap: 10, description: 'Partnership/affiliate outreach (sub-project 4, not yet built).' },
];

async function main() {
  for (const ch of CHANNELS) {
    const { error } = await supabase
      .from('guardrail_channels')
      .upsert({ ...ch, enabled: false, spend_ceiling_cents: 0 }, { onConflict: 'name', ignoreDuplicates: true });
    if (error) {
      console.error(`Failed to seed channel ${ch.name}:`, error.message);
      process.exitCode = 1;
      continue;
    }
    console.log(`Seeded channel: ${ch.name} (disabled, cap=${ch.daily_cap}/day)`);
  }
}

main();
