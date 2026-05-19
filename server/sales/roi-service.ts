/**
 * ROI Calculation Service — Ported from legacy calculator.js
 * Provides technical and financial justification for AuthiChain adoption.
 */

export interface ROICalculationInput {
  numProducts: number;
  complianceHoursPerMonth: number;
  hourlyRate: number;
  existingTechCosts: number;
  industry: string;
}

export interface ROICalculationResult {
  currentAnnualCost: number;
  authiChainAnnualCost: number;
  year1Savings: number;
  threeYearSavings: number;
  paybackMonths: number;
  timeSavingsPct: number;
  tierName: string;
  pricing: {
    implementationFee: number;
    subscriptionFee: number;
    discount: number;
    total: number;
  };
}

export function calculateROI(input: ROICalculationInput): ROICalculationResult {
  const {
    numProducts,
    complianceHoursPerMonth,
    hourlyRate,
    existingTechCosts
  } = input;

  // 1. Current Cost Analysis
  const annualLaborCost = complianceHoursPerMonth * 12 * hourlyRate;
  
  // Vertical-specific risk and operational costs
  let riskMitigationValue = 50000; // General
  let hiddenOperationCosts = 45000; // General
  
  if (input.industry === "medtech") {
    riskMitigationValue = 250000; // Clinical trial fraud prevention, recall risk
    hiddenOperationCosts = 150000; // Audit readiness, regulatory overhead
  } else if (input.industry === "pharma") {
    riskMitigationValue = 180000; // FDA compliance risk
    hiddenOperationCosts = 90000;
  } else if (input.industry === "timepieces") {
    riskMitigationValue = 400000; // Gray market prevention, resale trust
    hiddenOperationCosts = 50000; // Physical certificate management
  }
  
  const currentAnnualCost = annualLaborCost + existingTechCosts + riskMitigationValue + hiddenOperationCosts;

  // 2. AuthiChain Pricing Tier
  let subscriptionFee = 120000;
  let tierName = "Enterprise";

  if (input.industry === "medtech") {
    subscriptionFee = 150000; // Big-ticket MedTech pricing
    tierName = "MedTech Enterprise";
  } else if (input.industry === "timepieces") {
    subscriptionFee = 75000; // Independent Watch Brand pricing
    tierName = "Timepiece Integrity";
  } else {
    if (numProducts <= 1000) {
      subscriptionFee = 30000;
      tierName = "Starter";
    } else if (numProducts <= 10000) {
      subscriptionFee = 60000;
      tierName = "Professional";
    }
  }

  const implementationFee = 30000;
  const earlySigningDiscount = subscriptionFee * 0.10;
  const authiChainAnnualCost = implementationFee + (subscriptionFee - earlySigningDiscount);

  // 3. Savings Calculations
  const year1Savings = currentAnnualCost - authiChainAnnualCost;
  const paybackMonths = Number((authiChainAnnualCost / (currentAnnualCost / 12)).toFixed(1));
  
  // 3-year projection (10% annual escalation on legacy costs, fixed AuthiChain)
  const year2Legacy = currentAnnualCost * 1.10;
  const year3Legacy = year2Legacy * 1.10;
  const threeYearCurrent = currentAnnualCost + year2Legacy + year3Legacy;
  
  const year2AuthiChain = subscriptionFee * 1.05; // 5% increase for AC
  const year3AuthiChain = year2AuthiChain * 1.05;
  const threeYearAuthiChain = authiChainAnnualCost + year2AuthiChain + year3AuthiChain;
  const threeYearSavings = Math.round(threeYearCurrent - threeYearAuthiChain);

  const timeSavingsPct = 80; // Standard 80% reduction in manual hours

  return {
    currentAnnualCost,
    authiChainAnnualCost,
    year1Savings,
    threeYearSavings,
    paybackMonths,
    timeSavingsPct,
    tierName,
    pricing: {
      implementationFee,
      subscriptionFee,
      discount: earlySigningDiscount,
      total: authiChainAnnualCost
    }
  };
}
