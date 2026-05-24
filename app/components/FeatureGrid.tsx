import { SectionHeading } from "./SectionHeading";
import { Card } from "./Card";
import { features } from "./section-data";

export function FeatureGrid() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
      <SectionHeading
        eyebrow="Platform"
        title="Core platform sections"
        description="Each part of the landing page reinforces verification, provenance, and trust."
      />
      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {features.map((item) => (
          <Card key={item.title}>
            <h3 className="text-xl font-semibold">{item.title}</h3>
            <p className="mt-3 text-zinc-300">{item.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
