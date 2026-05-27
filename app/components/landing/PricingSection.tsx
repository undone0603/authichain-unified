import { SectionHeading } from "./SectionHeading";
import { PricingCard } from "./PricingCard";

const tiers = [
  { name: "Starter", price: "$0", features: ["Public verification page", "Basic scan receipts", "Manual onboarding"] },
  { name: "Growth", price: "$49/mo", features: ["Brand dashboard", "Workflow automations", "Batch tracking"] },
  { name: "Enterprise", price: "Custom", features: ["Multi-tenant controls", "API access", "Compliance support"] },
];

export function PricingSection() {
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
      <SectionHeading
        eyebrow="Pricing"
        title="Simple plans that scale"
        description="Start with a public trust layer, then expand into automations and enterprise controls."
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {tiers.map((tier) => (
          <PricingCard key={tier.name} {...tier} />
        ))}
      </div>
    </section>
  );
}
