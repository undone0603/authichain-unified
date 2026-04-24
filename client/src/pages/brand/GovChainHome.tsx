import { BRANDS } from "@shared/brands";
import { Landmark, Search, Brain, FileText, Gem, Send } from "lucide-react";
import { BrandLanding } from "./BrandLanding";

const features = [
  { icon: Search,   title: "SAM.gov Ingest",       desc: "Daily pull of federal opportunities matching `blockchain / authentication / provenance / verification / supply chain`. Quota-safe, 429-tolerant." },
  { icon: Brain,    title: "AI Scoring Cascade",   desc: "OpenAI → Groq → Gemini → Mistral ranks each opportunity for fit. Free providers keep the cost at zero while you scale." },
  { icon: FileText, title: "Auto-Drafted Proposals", desc: "≥75 fit score triggers an AI-written proposal draft, stored in Supabase and shipped to Airtable for review." },
  { icon: Gem,      title: "Proof-of-Win NFTs",    desc: "Opportunity NFTs minted on Base mainnet for won bids — an immutable, on-chain portfolio of federal awards." },
  { icon: Send,     title: "Slack Daily Digest",   desc: "Top 5 opportunities, counts ingested, and drafted — delivered to your channel at 06:00 UTC every day." },
  { icon: Landmark, title: "Federal-First Design", desc: "Cleared for OpenAI quota caps, SAM.gov rate limits, and missing blockchain keys — every external dep degrades gracefully." },
];

export default function GovChainHome() {
  return <BrandLanding brand={BRANDS.govchain} Logo={Landmark} features={features} />;
}
