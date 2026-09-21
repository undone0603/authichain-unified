export interface SamOpp {
  name: string;
  title: string;
  company: string;
  email: string;
  city: string;
  fit: number;
  value: number;
  notes: string;
}

/** Local catalog — no live SAM.gov API. Example addresses only. */
export const SAM_OPPS: SamOpp[] = [
  {
    name: "Col. James Whitfield",
    title: "Program Manager",
    company: "VA Credential Integrity",
    email: "james.whitfield@va.example",
    city: "Washington, DC",
    fit: 81,
    value: 120000,
    notes:
      "SAM.gov 36C10B26R0001 — public verify for veteran credentials. Fit 81. Originals stay on-prem.",
  },
  {
    name: "Mara Singh",
    title: "Supply-Chain Lead",
    company: "DHS Authentic Goods",
    email: "mara.singh@dhs.example",
    city: "Arlington, VA",
    fit: 74,
    value: 90000,
    notes: "SAM.gov 70RTAC26R0120 — lot-level authenticity for seized/imported goods. Fit 74.",
  },
  {
    name: "Capt. Leah Okonkwo",
    title: "Medical Logistics",
    company: "DoD Health Packaging",
    email: "leah.okonkwo@health.mil.example",
    city: "Falls Church, VA",
    fit: 77,
    value: 150000,
    notes:
      "SAM.gov HT9402-26-R-0033 — packaging seals adjacent to quality systems. Not a cleared device. Fit 77.",
  },
  {
    name: "Peter Holm",
    title: "Traceability Officer",
    company: "USDA Lot Seals",
    email: "peter.holm@usda.example",
    city: "Washington, DC",
    fit: 68,
    value: 40000,
    notes: "SAM.gov 1232SA26Q0088 — farm-lot provenance for inspected food. Fit 68.",
  },
];
