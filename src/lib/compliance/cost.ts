import { BOMPayload, CostCalculationResult, RulesetVersion } from './types';

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
  };

  const itemDetails: any[] = [];

  for (const comp of bom.components) {
    const itemTotalCost = (comp.materialCost + comp.laborCost + comp.overheadCost + comp.freightCost) * comp.quantity;
    totalManufacturingCost += itemTotalCost;

    const isUsOrigin = 
      comp.manufacturingCountry.toUpperCase() === 'USA' ||
      comp.manufacturingCountry.toUpperCase() === 'US' ||
      comp.countryOfOrigin.toUpperCase() === 'USA' ||
      comp.countryOfOrigin.toUpperCase() === 'US';

    const itemLabor = comp.laborCost * comp.quantity;
    const itemMaterial = comp.materialCost * comp.quantity;
    const itemOverhead = comp.overheadCost * comp.quantity;
    const itemFreight = comp.freightCost * comp.quantity;

    if (isUsOrigin) {
      usManufacturingCost += itemTotalCost;
      qualifyingCosts.usMaterials += itemMaterial;
      qualifyingCosts.usLabor += itemLabor;
      qualifyingCosts.usOverhead += itemOverhead;
      qualifyingCosts.usFreight += itemFreight;
    } else {
      foreignManufacturingCost += itemTotalCost;
      excludedCosts.foreignMaterials += itemMaterial;
      excludedCosts.foreignLabor += itemLabor;
      excludedCosts.foreignOverhead += itemOverhead;
      excludedCosts.foreignFreight += itemFreight;
    }

    itemDetails.push({
      componentId: comp.componentId,
      componentName: comp.componentName,
      isUsOrigin,
      totalCost: itemTotalCost,
      manufacturingCountry: comp.manufacturingCountry,
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
