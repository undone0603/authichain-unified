/**
 * Canonical HubSpot portal binding for AuthiChain.
 *
 * Source of truth for humans: config/hubspot-portal.json
 * The Grok HubSpot connector (2026-09-17) is portal 245112265 ("Authichain") on NA2.
 */

export const HUBSPOT_PORTAL = {
  id: Number(process.env.HUBSPOT_PORTAL_ID ?? 245112265),
  name: "Authichain",
  uiDomain: "app-na2.hubspot.com",
  apiBase: "https://api.hubapi.com",
  accountType: "STANDARD",
  timezone: "US/Eastern",
  currency: "USD",
  ownerId: 87978084,
  pipelineId: "default",
  pipelineLabel: "Sales Pipeline",
  grokConnector: {
    connected: true,
    connectedAt: "2026-09-17",
    source: "Grok HubSpot connector",
  },
  recordTypeIds: {
    contact: "0-1",
    company: "0-2",
    deal: "0-3",
    ticket: "0-5",
    task: "0-27",
  },
  stages: [
    { id: "appointmentscheduled", label: "Appointment Scheduled" },
    { id: "qualifiedtobuy", label: "Qualified To Buy" },
    { id: "presentationscheduled", label: "Presentation Scheduled" },
    { id: "decisionmakerboughtin", label: "Decision Maker Bought-In" },
    { id: "contractsent", label: "Contract Sent" },
    { id: "closedwon", label: "Closed Won" },
    { id: "closedlost", label: "Closed Lost" },
  ],
} as const;

export type HubSpotObject = keyof typeof HUBSPOT_PORTAL.recordTypeIds;

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
