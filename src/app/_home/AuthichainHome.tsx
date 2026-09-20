import { ShieldCheck, ScanLine, Award, QrCode, Landmark, Leaf } from 'lucide-react';
import { BrandLanding } from './BrandLanding';

/**
 * AuthiChain (authichain.com) — flagship authentication brand.
 * Narrative is limited to realized capabilities. Primary money path is
 * EU DPP Readiness via GET /api/checkout/dpp.
 */
export function AuthichainHome() {
  return (
    <BrandLanding
      brandId="authichain"
      eyebrow="Product authentication"
      headline="Issue seals. Bind products. Verify anywhere."
      subhead="The primary money path is EU DPP Readiness — live Stripe checkout at $299 from the published plan catalogue. QRON, GovChain, and StrainChain convert on paths that already work."
      primaryCta={{ label: 'Start DPP checkout', href: '/api/checkout/dpp' }}
      secondaryCta={{ label: 'View pricing', href: '/pricing' }}
      stats={[
        { value: 'Ed25519', label: 'Signed seals' },
        { value: 'Polygon', label: 'On-chain anchor' },
        { value: '$299', label: 'EU DPP Readiness' },
        { value: 'x402', label: 'Agent micropayments' },
      ]}
      features={[
        {
          icon: <Award className="h-6 w-6" />,
          title: 'EU DPP Readiness',
          desc: 'Live self-serve checkout. Written readiness assessment, merchant activation, and 50 workspace generations. $299 credited toward AuthiChain Basic on conversion.',
        },
        {
          icon: <ShieldCheck className="h-6 w-6" />,
          title: 'Issue a signed seal',
          desc: 'Cryptographically signed seals anchored on Polygon. Tamper-evident and publicly verifiable — no invented customer logos.',
        },
        {
          icon: <ScanLine className="h-6 w-6" />,
          title: 'Bind and verify',
          desc: 'Bind the seal to the physical item, then verify from any camera against the public record.',
        },
        {
          icon: <QrCode className="h-6 w-6" />,
          title: 'QRON Living QR',
          desc: 'Generate a signed, redirectable QR on qron.space/generate when packaging needs a scannable identity.',
        },
        {
          icon: <Landmark className="h-6 w-6" />,
          title: 'GovChain intake',
          desc: 'Federal contract intelligence starts on govchain.us/onboard. This page does not promise a live government mint.',
        },
        {
          icon: <Leaf className="h-6 w-6" />,
          title: 'StrainChain provenance',
          desc: 'Seed-to-sale intake on strainchain.io/onboard. Genetics passport totals are derived from lab panels, not transcribed.',
        },
      ]}
      closingLine="Start EU DPP Readiness."
    >
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 mb-3">How it works</h2>
        <p className="text-sm text-slate-600 mb-8 max-w-2xl">Three realized steps. No new product surface.</p>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { n: '01', t: 'Issue', d: 'Issue a cryptographically signed seal for the product.' },
            { n: '02', t: 'Bind', d: 'Bind it to the physical item — a Living QR, a passport, or a label.' },
            { n: '03', t: 'Verify', d: 'Confirm authenticity from any camera. Agents can pay per call on /x402.' },
          ].map((s) => (
            <article key={s.t} className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="text-sm font-semibold text-indigo-600 mb-2">{s.n}</div>
              <h3 className="text-base font-semibold text-slate-950 mb-2">{s.t}</h3>
              <p className="text-sm text-slate-600">{s.d}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="border-y border-slate-200 bg-slate-50 px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600 mb-3">Secondary</p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950 mb-3">x402 agent micropayments</h2>
          <p className="text-sm text-slate-600 mb-6">
            Funded agents verify a product for $0.05 USDC on Base. Public docs and unpaid 402 curls live at /x402.
          </p>
          <a
            href="/x402"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900 hover:border-slate-400"
          >
            Open /x402
          </a>
        </div>
      </section>
    </BrandLanding>
  );
}
