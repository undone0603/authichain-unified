import type { Metadata } from 'next';
import { CalendarClock, Package, Wrench, DollarSign, BookOpen } from 'lucide-react';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbSchema } from '@/lib/structured-data';
import { GuideForm } from './GuideForm';

const ACCENT = '#3B82F6';

export const metadata: Metadata = {
  title: 'EU Digital Product Passport: Complete Implementation Guide 2026',
  description:
    'Free guide: what the EU Digital Product Passport is, when it takes effect, which products are covered, how to implement it, and what compliance costs in 2026.',
  alternates: { canonical: 'https://authichain.com/resources/eu-dpp-guide' },
  openGraph: {
    title: 'EU Digital Product Passport: Complete Implementation Guide 2026',
    description:
      'The complete 2026 EU DPP playbook — timeline, product scope, data model, and costs. Free download.',
    url: 'https://authichain.com/resources/eu-dpp-guide',
    images: ['/og?title=EU%20DPP%20Implementation%20Guide%202026&brand=authichain'],
    type: 'article',
  },
};

const SECTIONS = [
  {
    icon: BookOpen,
    title: 'What Is a Digital Product Passport?',
    body: 'The EU Digital Product Passport (DPP) is a structured, machine-readable record of a product’s identity, materials, carbon footprint, repairability, and end-of-life data. Introduced by the Ecodesign for Sustainable Products Regulation (ESPR, Regulation 2024/1781), it attaches to each physical unit through a unique identifier — usually a QR code or NFC tag — that resolves to the passport for consumers, customs, and recyclers.',
  },
  {
    icon: CalendarClock,
    title: 'The Timeline You Need to Plan Around',
    body: 'The central EU DPP registry opens July 19, 2026. Battery passports become mandatory for EV and industrial batteries in February 2027. Textiles and electronics follow via delegated regulations from 2028, and by 2030 virtually all physical goods placed on the EU market must carry a Digital Product Passport. Early registration secures priority review.',
  },
  {
    icon: Package,
    title: 'Which Products Are Covered',
    body: 'Priority categories are batteries, textiles and apparel, electronics and ICT equipment, furniture, iron, steel, aluminium, tyres, and construction products. Scope expands through delegated acts. If you sell physical, non-food goods into the EU, assume you will be in scope before 2030 and plan accordingly.',
  },
  {
    icon: Wrench,
    title: 'How to Implement It',
    body: 'Model your product data to the DPP schema (unique identifier, material bill of materials, carbon footprint, repairability score), assign a unique identifier per unit, anchor the record for tamper-evidence, and generate the EPCIS 2.0 + JSON-LD payloads the registry expects. AuthiChain automates each of these steps so you go from catalog to registry-ready passports the same day.',
  },
  {
    icon: DollarSign,
    title: 'What Compliance Costs',
    body: 'Costs fall into three buckets: data collection (supplier LCA and material data), tooling (issuing and hosting passports), and verification. Legacy enterprise vendors quote six-figure annual deals. AuthiChain’s self-serve model starts well below the cost of a single compliance consultant, with no per-scan verification fees.',
  },
];

export default function EuDppGuidePage() {
  const breadcrumbLd = breadcrumbSchema([
    { name: 'Home', url: 'https://authichain.com' },
    { name: 'Resources', url: 'https://authichain.com/resources' },
    { name: 'EU DPP Guide', url: 'https://authichain.com/resources/eu-dpp-guide' },
  ]);

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'EU Digital Product Passport: Complete Implementation Guide 2026',
    description:
      'A complete guide to EU Digital Product Passport compliance in 2026 — regulation, timeline, product scope, implementation steps, and costs.',
    author: { '@type': 'Organization', name: 'AuthiChain' },
    publisher: {
      '@type': 'Organization',
      name: 'AuthiChain',
      url: 'https://authichain.com',
    },
    datePublished: '2026-07-03',
    dateModified: '2026-07-03',
    mainEntityOfPage: 'https://authichain.com/resources/eu-dpp-guide',
    about: 'EU Digital Product Passport',
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-600 selection:text-white">
      <JsonLd data={[breadcrumbLd, articleLd]} />

      {/* HERO */}
      <section className="relative px-6 pt-32 pb-16 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-20"
          style={{ background: `radial-gradient(ellipse 80% 50% at 30% -10%, ${ACCENT} 0%, transparent 60%)` }}
        />
        <div className="relative max-w-5xl mx-auto">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] mb-8"
            style={{ borderColor: `${ACCENT}55`, color: ACCENT, backgroundColor: `${ACCENT}12` }}
          >
            <BookOpen className="w-3 h-3" />
            Free Guide · 2026 Edition
          </span>
          <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter uppercase leading-[0.95] max-w-3xl">
            EU Digital Product Passport:<br />
            <span style={{ color: ACCENT }}>Complete Implementation Guide 2026</span>
          </h1>
          <p className="max-w-2xl text-zinc-400 text-base md:text-lg font-medium leading-relaxed">
            Everything you need to get compliant before the July 19, 2026 registry
            launch — the regulation, the timeline, which products are covered, how
            to implement, and what it actually costs.
          </p>
        </div>
      </section>

      {/* BODY + FORM */}
      <section className="max-w-5xl mx-auto px-6 pb-24 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-12">
        <div className="space-y-10">
          {SECTIONS.map((s) => (
            <article key={s.title}>
              <div className="flex items-center gap-3 mb-3">
                <s.icon className="w-5 h-5" style={{ color: ACCENT }} />
                <h2 className="text-lg font-black uppercase tracking-tight">{s.title}</h2>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400">{s.body}</p>
            </article>
          ))}
        </div>

        <aside className="lg:sticky lg:top-28 h-fit">
          <GuideForm />
        </aside>
      </section>
    </div>
  );
}
