/**
 * Industry Classification Engine
 * Maps products to one of 10 target verticals with automated workflows.
 */

export interface WorkflowStep {
  name: string;
  action: string;
}

export interface IndustryClassification {
  name: string;
  key: string;
  workflow: WorkflowStep[];
}

const INDUSTRIES: Record<string, { keywords: string[]; workflow: WorkflowStep[] }> = {
  cannabis: {
    keywords: ["cannabis", "marijuana", "thc", "cbd", "hemp", "strain", "dispensary", "metrc", "weed"],
    workflow: [
      { name: "METRC Sync", action: "sync_metrc_manifest" },
      { name: "COA Verification", action: "verify_coa" },
      { name: "Seed-to-Sale Log", action: "log_provenance" },
    ],
  },
  luxury: {
    keywords: ["luxury", "louis vuitton", "gucci", "prada", "rolex", "watch", "handbag", "designer"],
    workflow: [
      { name: "Brand Registry Check", action: "check_brand_registry" },
      { name: "Serial Verification", action: "verify_serial" },
      { name: "NFC Seal", action: "apply_nfc_seal" },
    ],
  },
  pharma: {
    keywords: ["pharma", "pharmaceutical", "drug", "medicine", "fda", "dscsa", "prescription"],
    workflow: [
      { name: "DSCSA Compliance", action: "verify_dscsa" },
      { name: "Lot Tracking", action: "track_lot" },
      { name: "Temperature Log", action: "log_cold_chain" },
    ],
  },
  electronics: {
    keywords: ["electronics", "chip", "semiconductor", "component", "circuit", "battery", "lithium", "ev", "tesla"],
    workflow: [
      { name: "Component Scan", action: "scan_component" },
      { name: "Origin Trace", action: "trace_origin" },
      { name: "Spec Verification", action: "verify_specs" },
    ],
  },
  fashion: {
    keywords: ["fashion", "clothing", "apparel", "sneaker", "shoe", "nike", "adidas", "textile"],
    workflow: [
      { name: "SKU Verification", action: "verify_sku" },
      { name: "Material Trace", action: "trace_material" },
      { name: "Grey Market Check", action: "check_grey_market" },
    ],
  },
  auto: {
    keywords: ["auto", "automotive", "car", "vehicle", "part", "engine", "brake", "oem"],
    workflow: [
      { name: "OEM Part Validation", action: "validate_oem" },
      { name: "VIN Cross-Ref", action: "crossref_vin" },
      { name: "Warranty Seal", action: "seal_warranty" },
    ],
  },
  food: {
    keywords: ["food", "organic", "coffee", "wine", "olive", "artisan", "farm", "produce", "roaster"],
    workflow: [
      { name: "Provenance Scan", action: "scan_provenance" },
      { name: "Certification Check", action: "check_certification" },
      { name: "Quality Seal", action: "seal_quality" },
    ],
  },
  art: {
    keywords: ["art", "painting", "sculpture", "gallery", "nft", "collectible", "print", "edition"],
    workflow: [
      { name: "Provenance Chain", action: "build_provenance_chain" },
      { name: "NFT Bind", action: "bind_nft_to_physical" },
      { name: "Certificate Issue", action: "issue_certificate" },
    ],
  },
  cosmetics: {
    keywords: ["cosmetics", "beauty", "skincare", "makeup", "fragrance", "perfume", "serum"],
    workflow: [
      { name: "Ingredient Verify", action: "verify_ingredients" },
      { name: "Batch Tracking", action: "track_batch" },
      { name: "Safety Seal", action: "apply_safety_seal" },
    ],
  },
  sports: {
    keywords: ["sports", "memorabilia", "jersey", "signed", "autograph", "trading card", "collectible"],
    workflow: [
      { name: "Signature Verify", action: "verify_signature" },
      { name: "Event Cross-Ref", action: "crossref_event" },
      { name: "Fan Certificate", action: "issue_fan_cert" },
    ],
  },
};

export function classifyIndustry(name: string, description: string): IndustryClassification {
  const text = `${name} ${description}`.toLowerCase();

  let bestMatch = "general";
  let bestScore = 0;

  for (const [key, industry] of Object.entries(INDUSTRIES)) {
    const score = industry.keywords.reduce(
      (acc, kw) => acc + (text.includes(kw) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      bestMatch = key;
    }
  }

  if (bestScore === 0) {
    return {
      name: "General Authentication",
      key: "general",
      workflow: [
        { name: "Product Scan", action: "scan_product" },
        { name: "Identity Verification", action: "verify_identity" },
        { name: "TrueMark Seal", action: "apply_truemark" },
      ],
    };
  }

  const matched = INDUSTRIES[bestMatch];
  return {
    name: bestMatch.charAt(0).toUpperCase() + bestMatch.slice(1),
    key: bestMatch,
    workflow: matched.workflow,
  };
}
