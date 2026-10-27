import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { faqSchema, breadcrumbSchema, type FaqItem } from '@/lib/structured-data';
import { ArrowRight, ListChecks, CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Batch Product Verification Living QR | QRON',
  description:
    'Create a scannable multi-item verification sheet with SKU, photo, and status for warehouse or retail counter. Free to try.',
  openGraph: {
    title: 'Batch Product Verification Living QR | QRON',
    description: 'One QR opens a multi-item scan sheet with status chips.',
    url: 'https://qron.space/modes/batch-verify',
  },
};

const FAQ: FaqItem[] = [
  {
    question: 'What does the batch portal show?',
    answer:
      'A multi-item scan sheet. Each row has SKU, photo, authenticity badge (Verified / Pending / Flagged), and last-scan timestamp. Optimized for warehouse or retail counter.',
  },
  {
    question: 'Does this prove authenticity?',
    answer: 'No. It displays the claims and status you control. Signed verification is in development.',
  },
  {
    question: 'How many free generations?',
    answer: '5 per visitor every 30 days. Then Starter Pack $29 for 100 generations, paid once.',
  },
];

export default function BatchVerifyPage() {
  const faqLd = faqSchema(FAQ);
  const breadcrumbLd = breadcrumbSchema([
    { name: 'Home', url: 'https://qron.space' },
    { name: 'Batch Verify', url: 'https://qron.space/modes/batch-verify' },
  ]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-emerald-500/30">
      <JsonLd data={[faqLd, breadcrumbLd]} />
      <section className="relative px-6 pt-32 pb-24 text-center">
        <div className="relative max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase leading-[0.92]">
            Batch Product<br />
            <span className="text-emerald-400">Verification QR</span>
          </h1>
          <p className="max-w-2xl mx-auto text-zinc-400 text-base md:text-lg font-medium leading-relaxed mb-10">
            One QR opens a multi-item scan sheet with SKU, photo, and status for warehouse or retail counter.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/generate?mode=batch_product_verification"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-10 py-4 text-xs font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
            >
              Generate free sample
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-10 py-4 text-xs font-black uppercase tracking-widest text-white hover:bg-zinc-900"
            >
              View pricing
            </Link>
          </div>
          <p className="mt-6 text-xs text-zinc-500">5 free samples, no card. Then Starter Pack $29 / 100 gens.</p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-black uppercase tracking-tight mb-6 text-center">What you get</h2>
        <ul className="space-y-3 text-zinc-300 text-sm">
          <li className="flex gap-2"><ListChecks className="w-5 h-5 text-emerald-400 flex-shrink-0" /> Clean table + status chips (Verified / Pending / Flagged)</li>
          <li className="flex gap-2"><ListChecks className="w-5 h-5 text-emerald-400 flex-shrink-0" /> SKU + photo + last-scan timestamp per row</li>
          <li className="flex gap-2"><ListChecks className="w-5 h-5 text-emerald-400 flex-shrink-0" /> Counts as 1 generation from Starter or Creator pack.</li>
        </ul>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-center text-3xl font-black uppercase tracking-tighter mb-8">FAQ</h2>
        <div className="space-y-4">
          {FAQ.map((item) => (
            <details key={item.question} className="border border-zinc-800 rounded-xl p-6 group">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-black uppercase tracking-tight">
                {item.question}
                <span className="text-lg transition-transform group-open:rotate-45 text-emerald-400">+</span>
              </summary>
              <p className="mt-4 text-[13px] leading-relaxed text-zinc-400">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="border-t border-zinc-900 px-6 py-16 text-center">
        <Link
          href="/generate?mode=batch_product_verification"
          className="inline-flex items-center justify-center gap-2 rounded-xl px-10 py-4 text-xs font-black uppercase tracking-widest text-white bg-emerald-600"
        >
          Start free sample
          <ArrowRight className="w-4 h-4" />
        </Link>
        <ul className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-x-8 gap-y-3">
          {['No card for samples', 'Starter $29 one-time', 'Not an authenticity proof'].map((t) => (
            <li key={t} className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              {t}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
