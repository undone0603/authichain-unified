export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import {
  generateOutreachEmail,
  generateFollowUpEmail,
  generateProofEmail,
  ONBOARDING_CHECKLIST,
  type OutreachContext,
} from '@/lib/industrial/outreach';

/**
 * POST /api/v1/outreach
 *
 * Generate outreach assets (emails, templates) for integration partners.
 * No authentication required — these are sales/marketing assets.
 *
 * Body:
 * {
 *   "type": "initial" | "followup" | "proof",
 *   "companyName": "string",
 *   "contactName": "string",
 *   "contactEmail": "string",
 *   "vertical": "manufacturing" | "supply-chain" | "compliance" | "federal",
 *   "useCase": "optional string",
 *   "monthlyVolume": "optional number",
 *   "currentChallenges": "optional string[]",
 *   "daysAgo": "optional number (for followup)"
 * }
 *
 * Returns: { subject, body, cta, estimatedValue }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const {
      type = 'initial',
      companyName,
      contactName,
      contactEmail,
      vertical,
      useCase,
      monthlyVolume,
      currentChallenges,
      daysAgo = 3,
    } = body as {
      type?: string;
      companyName?: string;
      contactName?: string;
      contactEmail?: string;
      vertical?: string;
      useCase?: string;
      monthlyVolume?: number;
      currentChallenges?: string[];
      daysAgo?: number;
    };

    // Validate required fields
    const requiredFields = { companyName, contactName, contactEmail, vertical };
    if (Object.values(requiredFields).some(f => !f || typeof f !== 'string')) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields: companyName, contactName, contactEmail, vertical' },
        { status: 400 }
      );
    }

    if (!['manufacturing', 'supply-chain', 'compliance', 'federal'].includes(vertical!)) {
      return NextResponse.json(
        { error: 'Invalid vertical. Expected: manufacturing, supply-chain, compliance, or federal' },
        { status: 400 }
      );
    }

    const ctx: OutreachContext = {
      companyName: companyName!,
      contactName: contactName!,
      contactEmail: contactEmail!,
      vertical: vertical! as OutreachContext['vertical'],
      useCase: typeof useCase === 'string' ? useCase : undefined,
      monthlyVolume: typeof monthlyVolume === 'number' ? monthlyVolume : undefined,
      currentChallenges: Array.isArray(currentChallenges) ? currentChallenges : undefined,
    };

    let asset;
    switch (type) {
      case 'followup':
        asset = generateFollowUpEmail(ctx, typeof daysAgo === 'number' ? daysAgo : 3);
        break;
      case 'proof':
        asset = generateProofEmail(ctx);
        break;
      case 'initial':
      default:
        asset = generateOutreachEmail(ctx);
    }

    return NextResponse.json({
      success: true,
      type,
      asset,
      checklist: ONBOARDING_CHECKLIST,
    });

  } catch (err: unknown) {
    console.error('[outreach] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/outreach/checklist
 *
 * Returns the partner onboarding checklist (public asset).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'json';

  if (format === 'markdown') {
    let md = '# AuthiChain Partner Onboarding\n\n';
    ONBOARDING_CHECKLIST.forEach(item => {
      md += `## Step ${item.step}: ${item.title}\n\n`;
      md += `**Time**: ${item.time}\n\n`;
      md += `${item.description}\n\n`;
    });
    return new NextResponse(md, {
      headers: { 'Content-Type': 'text/markdown' },
    });
  }

  return NextResponse.json({
    success: true,
    checklist: ONBOARDING_CHECKLIST,
  });
}
