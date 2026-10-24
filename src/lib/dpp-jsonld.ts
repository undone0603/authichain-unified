/**
 * JSON-LD export of a DPP readiness portfolio: a schema.org ItemList of
 * Product nodes. Every value is copied from the portfolio (which derives it
 * from the uploaded rows and dpp-readiness.ts). Deterministic: items sorted
 * by id, no timestamps. It describes readiness only: it does not state that
 * any product meets a regulation or is registered anywhere.
 */
import type { Portfolio, PortfolioItem } from "./compliance-portfolio";

const prop = (name: string, value: string | number) => ({
  "@type": "PropertyValue",
  name,
  value,
});

function product(i: PortfolioItem) {
  const props = [prop("dppObligation", i.obligation)];
  if (i.categoryLabel) props.push(prop("dppCategory", i.categoryLabel));
  if (i.legalDate) props.push(prop("dppLegalDate", i.legalDate));
  if (i.source) props.push(prop("dppSource", i.source));
  return {
    "@type": "Product",
    "@id": `urn:authichain:storepilot:product:${encodeURIComponent(i.id)}`,
    productID: i.id,
    name: i.name,
    ...(i.brand ? { brand: { "@type": "Brand", name: i.brand } } : {}),
    ...(i.serial ? { serialNumber: i.serial } : {}),
    additionalProperty: props,
  };
}

/** Required on every DPP report output (Research gate, verbatim). */
export const DPP_REPORT_DISCLAIMERS = [
  "Not affiliated with or endorsed by the European Commission.",
  "The QR in this report is not an EU DPP and is not registered in the EU DPP Registry.",
] as const;

export function portfolioToJsonLd(p: Portfolio) {
  const items = [...p.items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "EU DPP readiness report",
    description: DPP_REPORT_DISCLAIMERS.join(" "),
    numberOfItems: items.length,
    itemListElement: items.map((i, n) => ({
      "@type": "ListItem",
      position: n + 1,
      item: product(i),
    })),
  };
}
