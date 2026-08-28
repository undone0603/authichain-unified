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

const INDUSTRIES: Record<
  string,
  { keywords: string[]; workflow: WorkflowStep[]; brand?: string }
> = {
  cannabis: {
    keywords: [
      "cannabis",
      "marijuana",
      "thc",
      "cbd",
      "hemp",
      "strain",
      "dispensary",
      "metrc",
      "weed",
    ],
    workflow: [
      { name: "METRC Sync", action: "sync_metrc_manifest" },
      { name: "COA Verification", action: "verify_coa" },
      { name: "Seed-to-Sale Log", action: "log_provenance" },
    ],
    brand: "strainchain.io",
  },
  luxury: {
    keywords: [
      "luxury",
      "louis vuitton",
      "gucci",
      "prada",
      "rolex",
      "watch",
      "handbag",
      "designer",
      "jewellery",
      "jewelry",
      "wine",
      "champagne",
      "cognac",
      "nfc",
      "certificate of authenticity",
    ],
    workflow: [
      { name: "Brand Registry Check", action: "check_brand_registry" },
      { name: "Serial Verification", action: "verify_serial" },
      { name: "NFC Seal", action: "apply_nfc_seal" },
      { name: "EU DPP Export", action: "export_eu_dpp" },
    ],
    brand: "authichain.com",
  },
  pharma: {
    keywords: [
      "pharma",
      "pharmaceutical",
      "drug",
      "medicine",
      "fda",
      "dscsa",
      "prescription",
    ],
    workflow: [
      { name: "DSCSA Compliance", action: "verify_dscsa" },
      { name: "Lot Tracking", action: "track_lot" },
      { name: "Temperature Log", action: "log_cold_chain" },
    ],
    brand: "authichain.com",
  },
  electronics: {
    keywords: [
      "electronics",
      "chip",
      "semiconductor",
      "component",
      "circuit",
      "battery",
      "lithium",
      "ev",
      "tesla",
    ],
    workflow: [
      { name: "Component Scan", action: "scan_component" },
      { name: "Origin Trace", action: "trace_origin" },
      { name: "Spec Verification", action: "verify_specs" },
    ],
    brand: "authichain.com",
  },
  fashion: {
    keywords: [
      "fashion",
      "clothing",
      "apparel",
      "sneaker",
      "shoe",
      "nike",
      "adidas",
      "textile",
    ],
    workflow: [
      { name: "SKU Verification", action: "verify_sku" },
      { name: "Material Trace", action: "trace_material" },
      { name: "Grey Market Check", action: "check_grey_market" },
    ],
    brand: "authichain.com",
  },
  auto: {
    keywords: [
      "auto",
      "automotive",
      "car",
      "vehicle",
      "part",
      "engine",
      "brake",
      "oem",
    ],
    workflow: [
      { name: "OEM Part Validation", action: "validate_oem" },
      { name: "VIN Cross-Ref", action: "crossref_vin" },
      { name: "Warranty Seal", action: "seal_warranty" },
    ],
    brand: "authichain.com",
  },
  food: {
    keywords: [
      "food",
      "organic",
      "coffee",
      "wine",
      "olive",
      "artisan",
      "farm",
      "produce",
      "roaster",
    ],
    workflow: [
      { name: "Provenance Scan", action: "scan_provenance" },
      { name: "Certification Check", action: "check_certification" },
      { name: "Quality Seal", action: "seal_quality" },
    ],
    brand: "authichain.com",
  },
  art: {
    keywords: [
      "art",
      "painting",
      "sculpture",
      "gallery",
      "nft",
      "collectible",
      "print",
      "edition",
    ],
    workflow: [
      { name: "Provenance Chain", action: "build_provenance_chain" },
      { name: "NFT Bind", action: "bind_nft_to_physical" },
      { name: "Certificate Issue", action: "issue_certificate" },
    ],
    brand: "authichain.com",
  },
  cosmetics: {
    keywords: [
      "cosmetics",
      "beauty",
      "skincare",
      "makeup",
      "fragrance",
      "perfume",
      "serum",
    ],
    workflow: [
      { name: "Ingredient Verify", action: "verify_ingredients" },
      { name: "Batch Tracking", action: "track_batch" },
      { name: "Safety Seal", action: "apply_safety_seal" },
    ],
    brand: "authichain.com",
  },
  sports: {
    keywords: [
      "sports",
      "memorabilia",
      "jersey",
      "signed",
      "autograph",
      "trading card",
      "collectible",
    ],
    workflow: [
      { name: "Signature Verify", action: "verify_signature" },
      { name: "Event Cross-Ref", action: "crossref_event" },
      { name: "Fan Certificate", action: "issue_fan_cert" },
    ],
    brand: "authichain.com",
  },
};

const GENERAL_CLASSIFICATION: IndustryClassification = {
  name: "General Authentication",
  key: "general",
  workflow: [
    { name: "Product Scan", action: "scan_product" },
    { name: "Identity Verification", action: "verify_identity" },
    { name: "TrueMark Seal", action: "apply_truemark" },
  ],
};

function toClassification(key: string): IndustryClassification {
  const matched = INDUSTRIES[key];
  if (!matched) return GENERAL_CLASSIFICATION;
  return {
    name: key.charAt(0).toUpperCase() + key.slice(1),
    key,
    workflow: matched.workflow,
  };
}

/**
 * Deterministic keyword-matching fallback. Used when no LLM is configured,
 * or when the LLM call fails, so classification never hard-fails.
 */
export function classifyIndustryHeuristic(
  name: string,
  description: string
): IndustryClassification {
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

  if (bestScore === 0) return GENERAL_CLASSIFICATION;
  return toClassification(bestMatch);
}

const VALID_KEYS = [...Object.keys(INDUSTRIES), "general"];

/**
 * Classifies a product into one of the 10 target verticals using an LLM,
 * falling back to keyword matching when no OpenAI key is configured or the
 * LLM call fails for any reason (network error, bad response, etc.).
 */
export async function classifyIndustry(
  name: string,
  description: string,
  apiKey?: string
): Promise<IndustryClassification> {
  const key = apiKey ?? process.env.OPENAI_API_KEY ?? "";
  if (!key) return classifyIndustryHeuristic(name, description);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You classify physical products into exactly one of these industry verticals: ${VALID_KEYS.join(", ")}. Respond ONLY with a strict JSON object: {"key": "<one of the listed verticals>"}. Use "general" if none clearly apply.`,
          },
          {
            role: "user",
            content: `Product name: ${name}\nDescription: ${description}`,
          },
        ],
        max_tokens: 20,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) return classifyIndustryHeuristic(name, description);

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const parsed = JSON.parse(data.choices[0].message.content) as {
      key?: string;
    };
    const classifiedKey = parsed.key?.toLowerCase().trim() ?? "";

    if (!VALID_KEYS.includes(classifiedKey))
      return classifyIndustryHeuristic(name, description);
    return toClassification(classifiedKey);
  } catch {
    return classifyIndustryHeuristic(name, description);
  }
}
