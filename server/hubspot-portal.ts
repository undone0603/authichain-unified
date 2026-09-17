/**
 * Canonical HubSpot portal binding for AuthiChain.
 *
 * The Grok HubSpot connector (2026-09-17) is portal 245112265 ("Authichain")
 * on NA2. AgentZ, lead-sync scripts, and CRM helpers should import this module
 * instead of hard-coding portal IDs or UI hosts.
 */
import portalJson from "../config/hubspot-portal.json";

export const HUBSPOT_PORTAL = {
  id: Number(process.env.HUBSPOT_PORTAL_ID ?? portalJson.portalId),
  name: portalJson.name,
  uiDomain: portalJson.uiDomain,
  apiBase: portalJson.apiBase,
  accountType: portalJson.accountType,
  timezone: portalJson.timezone,
  currency: portalJson.currency,
  ownerId: portalJson.ownerId,
  pipelineId: portalJson.pipelineId,
  pipelineLabel: portalJson.pipelineLabel,
  grokConnector: portalJson.grokConnector,
  recordTypeIds: portalJson.recordTypeIds,
  stages: portalJson.stages,
} as const;

export type HubSpotObject = keyof typeof portalJson.recordTypeIds;

export type Vertical =
  | "strainchain"
  | "luxury"
  | "govchain"
  | "medical"
  | "qron"
  | "industrial"
  | "funding"
  | "other";

const VERTICAL_RULES: { vertical: Vertical; tests: RegExp[] }[] = [
  {
    vertical: "strainchain",
    tests: [
      /strainchain/i,
      /cannabis/i,
      /dispensary/i,
      /trulieve|curaleaf|cresco|lume|skymint|jars|gage|pure options|cloud cannabis|harvest health|metrc|thcv|sun-grown/i,
    ],
  },
  {
    vertical: "luxury",
    tests: [
      /lvmh|herm[eè]s|kering|gucci|rolex|breitling|richemont|cartier|porsche design|louis vuitton|sotheby|vacheron|iwc/i,
    ],
  },
  {
    vertical: "govchain",
    tests: [
      /\bdod\b|dhs|\bcbp\b|navy|sbir|svip|itar|apex accelerator|sam\.gov|federal pilot|dea cannabis tracking|govchain|mil-spec/i,
    ],
  },
  {
    vertical: "medical",
    tests: [/pfizer|dscsa|j&j|johnson & johnson|\bfda\b|colgate|medical device|eudamed|medtech/i],
  },
  {
    vertical: "qron",
    tests: [/\bqron\b/i, /product hunt/i, /onnit/i, /living qr/i],
  },
  {
    vertical: "industrial",
    tests: [/nike|apple|amazon|\b3m\b|hasbro|mattel|catl|pvh|calvin klein|tommy hilfiger/i],
  },
  {
    vertical: "funding",
    tests: [/casa verde|pitch by deel|databricks|\bSAFE\b|seed round/i],
  },
];

export function classifyVertical(name: string, description = ""): Vertical {
  const hay = `${name} ${description}`;
  for (const rule of VERTICAL_RULES) {
    if (rule.tests.some((t) => t.test(hay))) return rule.vertical;
  }
  return "other";
}

export function hubspotRecordUrl(object: HubSpotObject, id: string | number): string {
  const { id: portalId, uiDomain, recordTypeIds } = HUBSPOT_PORTAL;
  if (object === "task") {
    return `https://${uiDomain}/tasks/${portalId}/view/all/task/${id}`;
  }
  return `https://${uiDomain}/contacts/${portalId}/record/${recordTypeIds[object]}/${id}`;
}

export function hubspotPortalHome(): string {
  return `https://${HUBSPOT_PORTAL.uiDomain}/contacts/${HUBSPOT_PORTAL.id}`;
}
