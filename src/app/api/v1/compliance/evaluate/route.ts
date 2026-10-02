import { NextRequest, NextResponse } from 'next/server';
import { getRuleset, UnknownComplianceRulesetError } from '@/lib/compliance/rules';
import { calculateBOMCost } from '@/lib/compliance/cost';
import { evaluateSubstantialTransformation } from '@/lib/compliance/transformation';
import { evaluateClaim } from '@/lib/compliance/decision';
import type { BOMComponent } from '@/lib/compliance/types';

export const runtime = 'nodejs';

function isCompleteComponent(value: unknown): value is BOMComponent {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.componentId === 'string' &&
    c.componentId.trim().length > 0 &&
    typeof c.manufacturingCountry === 'string' &&
    c.manufacturingCountry.trim().length > 0 &&
    typeof c.countryOfOrigin === 'string' &&
    c.countryOfOrigin.trim().length > 0 &&
    typeof c.finalTransformationCountry === 'string' &&
    c.finalTransformationCountry.trim().length > 0 &&
    typeof c.materialCost === 'number' &&
    typeof c.laborCost === 'number' &&
    typeof c.overheadCost === 'number'
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, jurisdiction = 'FEDERAL_FTC', bom } = body;

    if (!productId || !bom || !Array.isArray(bom.components) || bom.components.length === 0) {
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
    if (!bom.components.every(isCompleteComponent)) {
      return NextResponse.json(
        { error: 'Each BOM component requires manufacturingCountry, countryOfOrigin, finalTransformationCountry, and a cost breakdown.' },
        { status: 400 }
      );
    }

    const ruleset = getRuleset(jurisdiction);
    const costCalculation = calculateBOMCost(bom, ruleset);

    const originDeterminations = bom.components.map((comp: BOMComponent) =>
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
      'This endpoint has no trusted supplier-document source configured and does not issue claim passports.'
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
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof UnknownComplianceRulesetError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && /cost breakdown/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Compliance evaluation error:', error);
    return NextResponse.json(
      { error: 'Internal compliance evaluation error' },
      { status: 500 }
    );
  }
}
