import { supabaseAdmin } from './supabase-admin';
import { sendEmail } from './email';

export async function processLeadOutreach() {
  // 1. Fetch high-score leads that haven't been contacted
  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('status', 'new')
    .gt('score', 70)
    .limit(5);

  if (error || !leads) return;

  for (const lead of leads) {
    // 2. Send personalized outreach
    await sendEmail({
      from: 'AuthiChain Growth <growth@qron.space>',
      to: lead.email,
      subject: `Authenticity Report for ${lead.company}`,
      html: `Hi ${lead.name}, I noticed high engagement with your products on AuthiChain. Let's discuss scaling your authenticity strategy.`,
      text: `Hi ${lead.name}, let's discuss scaling your authenticity strategy.`
    });

    // 3. Mark as contacted
    await supabaseAdmin
      .from('leads')
      .update({ status: 'contacted' })
      .eq('id', lead.id);
  }
}
