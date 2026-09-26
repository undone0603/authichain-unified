import type { Metadata } from "next";
import { VsPage, type ComparisonRow } from "../_VsPage";

export const metadata: Metadata = {
  title: "AuthiChain vs Everledger: Product authentication compared (2026)",
  description:
    "Honest comparison. AuthiChain issues a signed seal you can verify against a live JWKS. Everledger historically focused on diamond and luxury provenance. No prices or certifications invented.",
  alternates: { canonical: "https://authichain.com/vs/everledger" },
};

const rows: ComparisonRow[] = [
  { feature: "Public verifier + JWKS", authichain: "Live at /.well-known/jwks.json", competitor: "\u2014" },
  { feature: "Certificate contract on Polygon", authichain: "Contract live; issuance in development", competitor: "\u2014" },
  { feature: "Self-serve issue a seal", authichain: "In development", competitor: "\u2014" },
  { feature: "EU DPP export", authichain: "In development", competitor: "\u2014" },
  { feature: "AI 5-agent consensus", authichain: "Goal \u2014 labeled simulated until each agent has a real signal", competitor: "\u2014" },
  { feature: "Starts at", authichain: "Contact / onboard", competitor: "\u2014" },
];

const reasons = [
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
];

export default function Page() {
  return (
    <VsPage
      competitor="Everledger"
      slug="everledger"
      competitorSummary="Everledger built provenance records for diamonds and high-value goods. Public comparison cells we cannot verify are an em dash."
      rows={rows}
      reasons={reasons}
    />
  );
}
