import { NextRequest, NextResponse } from 'next/server';
import { getRuleset } from '@/lib/compliance/rules';
import { calculateBOMCost } from '@/lib/compliance/cost';
import { evaluateSubstantialTransformation } from '@/lib/compliance/transformation';
import { evaluateClaim } from '@/lib/compliance/decision';
import { createClaimPassport } from '@/lib/compliance/passport';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, jurisdiction = 'FEDERAL_FTC', bom } = body;

    if (!productId || !bom || !bom.components) {
      return NextResponse.json(
        { error: 'Missing required fields: productId, bom.components' },
        { status: 400 }
      );
    }
    if (body.documents !== undefined) {
      return NextResponse.json(
        { error: 'Client-supplied supplier documents are not trusted; submit evidence through the verified supplier-document workflow.' },
        { status: 400 }
      );
    }

    const ruleset = getRuleset(jurisdiction);
    const costCalculation = calculateBOMCost(bom, ruleset);

    const originDeterminations = bom.components.map((comp: any) =>
      evaluateSubstantialTransformation(comp)
    );

    const claimEvaluation = evaluateClaim(
      bom,
      costCalculation,
      originDeterminations,
      [],
      ruleset
    );
    claimEvaluation.warnings.push(
      'This endpoint has no trusted supplier-document source configured; claims remain subject to evidence review.'
    );

    const evidenceManifest = {
      productId,
      jurisdiction,
      rulesetVersion: ruleset.version,
      sourceHash: ruleset.sourceHash,
      costCalculation,
      originDeterminations,
      evaluatedAt: new Date().toISOString(),
    };

    const determinationId = `det_${Math.random().toString(36).substring(2, 10)}`;
    const passport = createClaimPassport(
      productId,
      determinationId,
      claimEvaluation,
      evidenceManifest,
      body.client
    );

    return NextResponse.json(
      {
        success: true,
        ruleset: {
          id: ruleset.id,
          citation: ruleset.citation,
          version: ruleset.version,
        },
        costCalculation,
        originDeterminations,
        claimEvaluation,
        passport,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Compliance evaluation error:', error);
    return NextResponse.json(
      { error: 'Internal compliance evaluation error', details: error.message },
      { status: 500 }
    );
  }
}
