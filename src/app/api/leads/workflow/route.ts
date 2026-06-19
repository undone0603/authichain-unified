export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface WorkflowTrigger {
  type: 'auto_nurture' | 'score_all' | 'advance_qualified' | 'send_followups';
  limit?: number;
}

const EMAIL_TEMPLATES = {
  intro_qron: {
    subject: 'You discovered QRON.space — Generate AI Art Inside QR Codes',
    body: `Hi there,

Thanks for exploring QRON.space! We create QR codes that are actually beautiful — powered by AI vision markers.

Your business gets:
✨ AI-generated art that converts scans 3x better
📊 Detailed scan analytics & heatmaps
🔗 Dynamic linking (update URLs without reprinting)

Book a 15-min demo to see QRON in action:
[DEMO_LINK]

Best,
The QRON Team`,
  },
  intro_authichain: {
    subject: 'AuthiChain: Digital Credentials for Your Business',
    body: `Hi there,

AuthiChain secures your digital credentials end-to-end.

Use cases:
🎓 Employee certifications
📜 Product authenticity proofs
🔐 Blockchain-verified documents

See how [Company] uses AuthiChain:
[CASE_STUDY_LINK]

Ready to go digital? Let's talk.
[DEMO_LINK]

Best,
AuthiChain Team`,
  },
  intro_govchain: {
    subject: 'GovChain.us — Governance for Your DAO',
    body: `Hi there,

Build sustainable DAOs with GovChain governance infrastructure.

Features:
⚖️ Multi-sig voting with delegation
💰 Staking rewards ($QRON yields 12.4%)
📋 Proposal management & archival

Interested? Book a technical walkthrough:
[DEMO_LINK]

Best,
GovChain Partnerships`,
  },
  intro_strainchain: {
    subject: 'StrainChain.io — Full Supply Chain Visibility',
    body: `Hi there,

StrainChain gives you complete supply chain transparency.

Track:
🌍 GPS locations in real-time
🌡️ Temperature & humidity compliance
🔗 Immutable blockchain audit trail

See it in action:
[DEMO_LINK]

Best,
StrainChain Team`,
  },
};

async function runAutoNurture() {
  try {
    const { data: newLeads } = await admin
      .from('lead_captures')
      .select('*')
      .eq('status', 'new')
      .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(50);

    if (!newLeads || newLeads.length === 0) return { processed: 0 };

    for (const lead of newLeads) {
      if ((lead.score || 0) >= 50) {
        await admin
          .from('lead_captures')
          .update({ status: 'contacted' })
          .eq('id', lead.id);

        const templateKey = `intro_${(lead.product_interest || 'qron').toLowerCase()}` as keyof typeof EMAIL_TEMPLATES;
        const template = EMAIL_TEMPLATES[templateKey] || EMAIL_TEMPLATES.intro_qron;

        await admin.from('automation_logs').insert({
          workflow_name: 'auto_nurture_email',
          status: 'completed',
          payload: {
            lead_id: lead.id,
            email: lead.email,
            template: templateKey,
          },
        });
      }
    }

    return { processed: newLeads.length };
  } catch (err) {
    console.error('Auto nurture error:', err);
    return { error: String(err) };
  }
}

async function runScoreAll() {
  try {
    const { data: allLeads } = await admin
      .from('lead_captures')
      .select('*')
      .in('status', ['new', 'contacted']);

    if (!allLeads) return { processed: 0 };

    for (const lead of allLeads) {
      let score = lead.score || 0;

      if (lead.emailOpened) score += 15;
      if (lead.emailClicked) score += 25;
      if (lead.demoStarted) score += 40;
      if (lead.contractSent) score += 50;
      if (lead.contractOpened) score += 20;
      if (lead.contractSigned) score += 100;
      if (lead.isVip) score += 30;

      score = Math.min(score, 100);

      if (score !== lead.score) {
        await admin
          .from('lead_captures')
          .update({ score })
          .eq('id', lead.id);
      }
    }

    return { processed: allLeads.length };
  } catch (err) {
    console.error('Score all error:', err);
    return { error: String(err) };
  }
}

async function runAdvanceQualified() {
  try {
    const { data: qualified } = await admin
      .from('lead_captures')
      .select('*')
      .eq('status', 'qualified')
      .gt('score', 70)
      .limit(20);

    if (!qualified) return { processed: 0 };

    for (const lead of qualified) {
      await admin
        .from('lead_captures')
        .update({ status: 'demoed' })
        .eq('id', lead.id);

      await admin.from('automation_logs').insert({
        workflow_name: 'auto_advance_to_demo',
        status: 'completed',
        payload: {
          lead_id: lead.id,
          email: lead.email,
          score: lead.score,
        },
      });
    }

    return { processed: qualified.length };
  } catch (err) {
    console.error('Advance qualified error:', err);
    return { error: String(err) };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { type, limit } = (await request.json()) as WorkflowTrigger;

    if (!type) {
      return NextResponse.json({ error: 'Workflow type required' }, { status: 400 });
    }

    let result;

    switch (type) {
      case 'auto_nurture':
        result = await runAutoNurture();
        break;
      case 'score_all':
        result = await runScoreAll();
        break;
      case 'advance_qualified':
        result = await runAdvanceQualified();
        break;
      default:
        return NextResponse.json({ error: 'Unknown workflow type' }, { status: 400 });
    }

    await admin.from('automation_logs').insert({
      workflow_name: `workflow_${type}`,
      status: 'completed',
      payload: result,
    });

    return NextResponse.json({
      type,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
