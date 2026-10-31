import { getRuleset, UnknownComplianceRulesetError } from "./rules";
import { calculateBOMCost } from "./cost";
import { evaluateSubstantialTransformation } from "./transformation";
import { evaluateClaim } from "./decision";
import type { BOMComponent } from "./types";

export type EvaluateHttpResult = {
  status: number;
  body: Record<string, unknown>;
};

function isCompleteComponent(value: unknown): value is BOMComponent {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.componentId === "string" &&
    c.componentId.trim().length > 0 &&
    typeof c.manufacturingCountry === "string" &&
    c.manufacturingCountry.trim().length > 0 &&
    typeof c.countryOfOrigin === "string" &&
    c.countryOfOrigin.trim().length > 0 &&
    typeof c.finalTransformationCountry === "string" &&
    c.finalTransformationCountry.trim().length > 0 &&
    typeof c.materialCost === "number" &&
    typeof c.laborCost === "number" &&
    typeof c.overheadCost === "number"
  );
}

export function evaluateComplianceRequest(body: unknown): EvaluateHttpResult {
  if (!body || typeof body !== "object") {
    return {
      status: 400,
      body: { error: "Missing required fields: productId, bom.components" },
    };
  }
  const req = body as Record<string, unknown>;
  const productId = req.productId;
  const jurisdiction =
    typeof req.jurisdiction === "string" ? req.jurisdiction : "FEDERAL_FTC";
  const bom = req.bom;

  if (
    typeof productId !== "string" ||
    !productId.trim() ||
    !bom ||
    typeof bom !== "object" ||
    !Array.isArray((bom as { components?: unknown }).components) ||
    (bom as { components: unknown[] }).components.length === 0
  ) {
    return {
      status: 400,
      body: { error: "Missing required fields: productId, bom.components" },
    };
  }
  if (req.documents !== undefined) {
    return {
      status: 400,
      body: {
        error:
          "Client-supplied supplier documents are not trusted; submit evidence through the verified supplier-document workflow.",
      },
    };
  }
  const components = (bom as { components: unknown[] }).components;
  if (!components.every(isCompleteComponent)) {
    return {
      status: 400,
      body: {
        error:
          "Each BOM component requires manufacturingCountry, countryOfOrigin, finalTransformationCountry, and a cost breakdown.",
      },
    };
  }

  try {
    const payload = bom as { productId?: string; version?: string };
    const bomPayload = {
      productId: payload.productId ?? productId,
      version: payload.version ?? "v1.0",
      components,
    };
    const ruleset = getRuleset(jurisdiction);
    const costCalculation = calculateBOMCost(bomPayload, ruleset);
    const originDeterminations = components.map(comp =>
      evaluateSubstantialTransformation(comp)
    );
    const claimEvaluation = evaluateClaim(
      bomPayload,
      costCalculation,
      originDeterminations,
      [],
      ruleset
    );
    claimEvaluation.warnings.push(
      "This endpoint has no trusted supplier-document source configured and does not issue claim passports."
    );
    return {
      status: 200,
      body: {
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
    };
  } catch (error: unknown) {
    if (error instanceof UnknownComplianceRulesetError) {
      return { status: 400, body: { error: error.message } };
    }
    if (error instanceof Error && /cost breakdown/i.test(error.message)) {
      return { status: 400, body: { error: error.message } };
    }
    return { status: 500, body: { error: "Internal compliance evaluation error" } };
  }
}
