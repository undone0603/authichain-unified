import type { ComparisonRow, VsDefinition } from "./vs-pages";

/** Restored compare pages. Import and concat onto VS_PAGES. */
export const RESTORED_VS_PAGES: VsDefinition[] = [
  {
    slug: "everledger",
    competitor: "Everledger",
    title: "AuthiChain vs Everledger: Product authentication compared (2026)",
    description:
      "Honest comparison. AuthiChain issues a signed seal you can verify against a live JWKS. Everledger historically focused on diamond and luxury provenance. No prices or certifications invented.",
    competitorSummary:
      "Everledger built provenance records for diamonds and high-value goods. Public comparison cells we cannot verify are an em dash.",
    rows: [
      { feature: "Public verifier + JWKS", authichain: "Live at /.well-known/jwks.json", competitor: "\u2014" },
      { feature: "Certificate contract on Polygon", authichain: "Contract live; issuance in development", competitor: "\u2014" },
      { feature: "Self-serve issue a seal", authichain: "In development", competitor: "\u2014" },
      { feature: "EU DPP export", authichain: "In development", competitor: "\u2014" },
      { feature: "AI 5-agent consensus", authichain: "Goal \u2014 labeled simulated until each agent has a real signal", competitor: "\u2014" },
      { feature: "Starts at", authichain: "Contact / onboard", competitor: "\u2014" },
    ],
    reasons: [
      {
        title: "A seal you can check",
        desc: "The public JWKS and protocol pages are live. A valid signature is signed evidence \u2014 not a guarantee the object in your hand is genuine.",
      },
      {
        title: "No invented competitor cells",
        desc: "Where Everledger's current product is not independently verified here, the cell is an em dash.",
      },
      {
        title: "Pilot, not a smash page",
        desc: "Request a contractor or brand seal. No $299 on this URL.",
      },
    ],
  },
  {
    slug: "strainsecure",
    competitor: "StrainSecure",
    title: "AuthiChain vs StrainSecure: Cannabis provenance compared (2026)",
    description:
      "StrainChain is the cannabis vertical of AuthiChain. Comparison uses only defensible cells. METRC sync is a roadmap goal, not live.",
    competitorSummary:
      "StrainSecure is evaluated here as a cannabis track-and-trace option. Unverified competitor cells are an em dash.",
    rows: [
      { feature: "Public scan URL", authichain: "Live /verify", competitor: "\u2014" },
      { feature: "Signed COA on-chain", authichain: "Goal \u2014 hash of an issuer-supplied COA, not a lab result", competitor: "\u2014" },
      { feature: "METRC validated integrator", authichain: "Goal \u2014 not on Metrc's list", competitor: "\u2014" },
      { feature: "Self-serve SKU seal", authichain: "In development", competitor: "\u2014" },
      { feature: "Starts at", authichain: "Contact / onboard", competitor: "\u2014" },
    ],
    reasons: [
      {
        title: "Provenance, not a lab",
        desc: "A StrainChain seal records what the issuer submitted. It is not a COA and not a Metrc sync.",
      },
      {
        title: "Michigan-first intake",
        desc: "Onboard with license number and optional METRC tag. Tag is a field, not a live feed.",
      },
      {
        title: "Same verifier as AuthiChain",
        desc: "One JWKS, one /verify. Vertical copy only.",
      },
    ],
  },
];

export const RESTORED_VS_ROWS: Record<string, ComparisonRow[]> = Object.fromEntries(
  RESTORED_VS_PAGES.map((p) => [p.slug, p.rows]),
);
