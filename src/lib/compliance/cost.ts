import { BOMComponent, BOMPayload, CostCalculationResult, RulesetVersion } from './types';

function isUsCountry(value: string | undefined): boolean {
  const v = (value ?? '').trim().toUpperCase();
  return v === 'US' || v === 'USA';
}

function requireCostBreakdown(comp: BOMComponent): void {
  const parts = [comp.materialCost, comp.laborCost, comp.overheadCost];
  if (parts.some(n => typeof n !== 'number' || !Number.isFinite(n))) {
    throw new Error('BOM component cost breakdown is required');
  }
  const sum = parts.reduce((acc, n) => acc + n, 0);
  if (sum === 0 && comp.unitCost > 0) {
    throw new Error('BOM component cost breakdown is required');
  }
}

export function calculateBOMCost(bom: BOMPayload, ruleset: RulesetVersion): CostCalculationResult {
  let totalManufacturingCost = 0;
  let usManufacturingCost = 0;
  let foreignManufacturingCost = 0;

  const qualifyingCosts: Record<string, number> = {
    usMaterials: 0,
    usLabor: 0,
    usOverhead: 0,
    usFreight: 0,
  };

  const excludedCosts: Record<string, number> = {
    foreignMaterials: 0,
    foreignLabor: 0,
    foreignOverhead: 0,
    foreignFreight: 0,
    usFreight: 0,
  };

  const itemDetails: Array<Record<string, unknown>> = [];

  for (const comp of bom.components) {
    requireCostBreakdown(comp);
    const quantity = Number.isFinite(comp.quantity) ? comp.quantity : 0;
    const manufacturingCost =
      (comp.materialCost + comp.laborCost + comp.overheadCost) * quantity;
    const itemFreight = (comp.freightCost || 0) * quantity;
    totalManufacturingCost += manufacturingCost;

    const isUsOrigin =
      isUsCountry(comp.manufacturingCountry) && isUsCountry(comp.countryOfOrigin);

    const itemLabor = comp.laborCost * quantity;
    const itemMaterial = comp.materialCost * quantity;
    const itemOverhead = comp.overheadCost * quantity;

    if (isUsOrigin) {
      usManufacturingCost += manufacturingCost;
      qualifyingCosts.usMaterials += itemMaterial;
      qualifyingCosts.usLabor += itemLabor;
      qualifyingCosts.usOverhead += itemOverhead;
      excludedCosts.usFreight += itemFreight;
    } else {
      foreignManufacturingCost += manufacturingCost;
      excludedCosts.foreignMaterials += itemMaterial;
      excludedCosts.foreignLabor += itemLabor;
      excludedCosts.foreignOverhead += itemOverhead;
      excludedCosts.foreignFreight += itemFreight;
    }

    itemDetails.push({
      componentId: comp.componentId,
      componentName: comp.componentName,
      isUsOrigin,
      totalCost: manufacturingCost,
      manufacturingCountry: comp.manufacturingCountry,
      countryOfOrigin: comp.countryOfOrigin,
    });
  }

  const usContentPercentage = totalManufacturingCost > 0
    ? Number(((usManufacturingCost / totalManufacturingCost) * 100).toFixed(4))
    : 0;

  const foreignContentPercentage = totalManufacturingCost > 0
    ? Number(((foreignManufacturingCost / totalManufacturingCost) * 100).toFixed(4))
    : 100;

  return {
    totalManufacturingCost: Number(totalManufacturingCost.toFixed(4)),
    usManufacturingCost: Number(usManufacturingCost.toFixed(4)),
    foreignManufacturingCost: Number(foreignManufacturingCost.toFixed(4)),
    usContentPercentage,
    foreignContentPercentage,
    qualifyingCosts,
    excludedCosts,
    calculationDetails: {
      rulesetId: ruleset.id,
      componentCount: bom.components.length,
      items: itemDetails,
    },
  };
}
