import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Shield, Zap, Globe } from 'lucide-react';

export const metadata: Metadata = {
  title: 'QRON Stamps | Collectible Authenticated QR Art',
  description:
    'Thematic QR Stamp collections — each stamp is a cryptographically signed piece of AI art that links to a verified digital experience. Collect, gift, or display.',
  openGraph: {
    title: 'QRON Stamps — Collectible Authenticated QR Art',
    description:
      'Thematic QR Stamps with cryptographic authentication. Each scan unlocks a verified digital experience.',
    images: [{ url: '/media/samples/01_flux_qron_space.png', width: 1200, height: 1200 }],
  },
};

const COLLECTIONS = [
  {
    name: 'Global Ocean Wildlife',
    price: 0.85,
    description: 'Underwater ecosystems rendered in vivid QR mosaic — sea turtles, coral, deep currents.',
    image: '/media/samples/05-bioluminescent-deep.png',
    tag: 'Nature',
  },
  {
    name: 'Liberty & Service',
    price: 0.60,
    description: 'Patriotic imagery woven into cryptographic patterns. The eagle, the flag, the seal.',
    image: '/media/samples/01_flux_qron_space.png',
    tag: 'Heritage',
  },
  {
    name: 'Renewal & Hope',
    price: 1.10,
    description: 'Phoenix rising from digital flame — resilience and transformation encoded in light.',
    image: '/media/samples/04-cosmic-nebula.png',
    tag: 'Symbolic',
  },
  {
    name: 'Cybersecurity & Data',
    price: 2.00,
    description: 'Matrix cascades, circuit traces, and encrypted pulse — the art of the secure web.',
    image: '/media/samples/03-matrix-cascade.png',
    tag: 'Tech',
  },
  {
    name: 'Holographic Mosaic',
    price: 1.25,
    description: 'Shifting iridescent shards that catch light differently at every angle.',
    image: '/media/samples/02-holographic-mosaic.png',
    tag: 'Abstract',
  },
  {
    name: 'Aurora Dreams',
    price: 0.95,
    description: 'Northern lights and teal aurora — shifting colour fields as data.',
    image: '/media/samples/08-aurora-dreams.png',
    tag: 'Nature',
  },
];

const WHY = [
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Cryptographically Signed',
    desc: 'Every stamp carries an Ed25519 signature anchored to Polygon. Counterfeit-proof by design.',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Scan-to-Verify',
    desc: 'One camera tap confirms authenticity and unlocks the full digital experience behind the art.',
  },
  {
    icon: <Globe className="w-5 h-5" />,
    title: 'Physical + Digital',
    desc: 'Print on archival stock, embed in product packaging, or display as framed digital collectibles.',
  },
];

export default function StampsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Hero */}
      <section className="relative px-6 pt-32 pb-20 text-center overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[380px] opacity-25"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% -10%, #c9a22733 0%, transparent 60%)' }}
        />
        <div className="relative max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#c9a22740] bg-[#c9a2270d] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#c9a227] mb-8">
            QRON · Thematic QR Stamps
          </span>
          <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase leading-[0.95]">
            Art you can{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(120deg, #c9a227, #f5d77a 60%, #c9a227)' }}
            >
              verify.
            </span>
          </h1>
          <p className="max-w-xl mx-auto text-zinc-400 text-base md:text-lg font-medium leading-relaxed mb-10">
            Each QRON Stamp is a signed piece of AI art — scannable, verifiable, and forever linked to its
            authentic origin on the blockchain.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/studio"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-10 py-4 text-xs font-black uppercase tracking-widest text-black bg-[#c9a227] hover:-translate-y-0.5 transition-transform"
            >
              Design a Stamp <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/gallery"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-10 py-4 text-xs font-black uppercase tracking-widest text-white hover:bg-zinc-900 transition-colors"
            >
              Browse Gallery
            </Link>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="border-y border-zinc-900 bg-zinc-950/40">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-900">
          {WHY.map((w) => (
            <div key={w.title} className="px-8 py-8 flex flex-col gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#c9a2271a] flex items-center justify-center text-[#c9a227]">
                {w.icon}
              </div>
              <div className="font-bold text-sm">{w.title}</div>
              <div className="text-zinc-500 text-sm leading-relaxed">{w.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Collections */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c9a227] mb-3">Collections</p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-12">Current series.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {COLLECTIONS.map((c) => (
              <article
                key={c.name}
                className="group rounded-xl border border-zinc-900 bg-zinc-950 overflow-hidden hover:border-[#c9a22740] transition-colors"
              >
                <div className="aspect-square relative overflow-hidden bg-zinc-900">
                  <Image
                    src={c.image}
                    alt={c.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <span className="absolute top-3 left-3 rounded-full bg-black/70 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400 backdrop-blur-sm">
                    {c.tag}
                  </span>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-bold text-sm leading-tight">{c.name}</h3>
                    <span className="shrink-0 font-black text-[#c9a227] text-sm">
                      ${c.price.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-zinc-500 text-xs leading-relaxed mb-4">{c.description}</p>
                  <Link
                    href={`/studio?collection=${encodeURIComponent(c.name)}`}
                    className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#c9a227] hover:text-[#f5d77a] transition-colors"
                  >
                    Customize <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Physical Immersion CTA */}
      <section className="py-24 px-6 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c9a227] mb-4">
            Physical Immersion Walk
          </p>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter mb-5">
            Bring QRON to life at scale.
          </h2>
          <p className="max-w-xl mx-auto text-zinc-400 text-base leading-relaxed mb-8">
            Commission large-format QRON installations for heritage sites, industrial parks, and public
            spaces — where every scan tells the story of a place, a product, or a community.
          </p>
          <Link
            href="/contact?interest=physical-installation"
            className="inline-flex items-center justify-center gap-2 rounded-xl px-10 py-4 text-xs font-black uppercase tracking-widest text-black bg-[#c9a227] hover:-translate-y-0.5 transition-transform"
          >
            Request a Commission <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
