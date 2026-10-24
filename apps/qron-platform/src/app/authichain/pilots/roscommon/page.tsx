import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronLeft,
  Stamp,
  Compass,
  Headphones,
  Ticket,
  ArrowRight,
  MapPin
} from 'lucide-react';

const stampSheet = [
  {
    theme: 'Liberty & Service',
    img: '/media/usa/unnamed2.jpg',
    sub: 'America, scannable',
  },
  {
    theme: 'Wildlife & Heritage',
    img: '/media/samples/02_flux_strainchain.png',
    sub: 'Au Sable forests, on-chain',
  },
  {
    theme: 'Renewal & Hope',
    img: '/media/samples/05_flux_medchain.png',
    sub: 'Public-good provenance',
  },
  {
    theme: 'Cybersecurity & Data',
    img: '/media/samples/01-neon-glitch.png',
    sub: '',
  },
] as const;

export const metadata: Metadata = {
  title: 'Roscommon Phygital Postcard Concept | AuthiChain Protocol',
  description:
    'A Heart-of-Michigan pilot proposal: QRON-coded postcards that open a 3D landmark tour, AI-narrated town history, and a local-business coupon book — a concept for local sponsorship revenue.',
};

const experiences = [
  {
    icon: Compass,
    tag: 'Tourism Driver',
    title: 'The 3D Landmark Tour',
    body:
      "Tap to step onto the shores of Higgins Lake at sunset, or inside the historic Gallimore Boarding House. A 360° AR view turns the recipient's living room into a micro-tourism billboard — which we propose funding through local sponsorships.",
    color: 'text-gold',
    border: 'border-gold/30',
    glow: 'rgba(201,162,39,0.08)',
  },
  {
    icon: Headphones,
    tag: 'Educational & Cultural',
    title: 'The AI Story of Town History',
    body:
      'A 60-second AI-narrated story — voiced like a 19th-century lumberjack or local historian — about the Au Sable River, the logging boom, and the founding of Roscommon. Every postcard becomes a miniature museum exhibit.',
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    glow: 'rgba(56,189,248,0.08)',
  },
  {
    icon: Ticket,
    tag: 'Economic Stimulus',
    title: 'The Local Business Discount',
    body:
      'A digital coupon book drops down: free coffee at a local roaster, 15% off a kayak rental at the Au Sable River Outfitters. Local businesses pay a small sponsorship fee to be featured — the postal service could capture a recurring secondary revenue stream.',
    color: 'text-green-400',
    border: 'border-green-500/30',
    glow: 'rgba(34,197,94,0.08)',
  },
] as const;

export default function RoscommonPilotPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <header className="flex items-center justify-between mb-16 border-b border-zinc-900 pb-8">
          <Link href="/authichain/pilots" className="group flex items-center gap-2">
            <ChevronLeft className="w-4 h-4 text-zinc-500 group-hover:text-gold transition-colors" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors">
              All Pilots
            </span>
          </Link>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-widest">
            <Stamp className="w-3 h-3" />
            Concept · Unsolicited proposal
          </div>
        </header>

        <div className="flex items-center gap-2 mb-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">
          <MapPin className="w-3 h-3 text-gold" />
          Roscommon, Michigan · 44.4998° N, 84.5947° W
        </div>

        <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter uppercase leading-[0.9]">
          THE HEART OF <br />
          <span className="gold-text">MICHIGAN.</span>
        </h1>

        <p className="max-w-2xl text-zinc-400 text-lg font-medium mb-16 leading-relaxed">
          An unsolicited concept we would like to propose to postal and tourism partners: a thematic series of
          concept QRON postcard designs where each one opens a phygital portal — fully scannable,
          cryptographically signed, and tied to a local economic engine. Roscommon is
          the testbed because rich history, natural landmarks, and a tight-knit local
          economy converge here.
        </p>

        {/* Stamp sheet — actual issue mockup */}
        <div className="flex flex-col items-center gap-6 mb-16">
          <div
            className="relative w-full max-w-3xl rounded-md overflow-hidden"
            style={{ filter: 'drop-shadow(0 24px 60px rgba(201,162,39,0.15))' }}
          >
            <Image
              src="/media/roscommon-stamp-sheet.png"
              alt="Concept artwork, not postage"
              width={1920}
              height={1080}
              priority
              className="w-full h-auto"
              sizes="(min-width: 768px) 768px, 100vw"
            />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 text-center max-w-md">
            Concept artwork · Not postage — &ldquo;Scan the forest to explore Roscommon.&rdquo;
          </p>
        </div>

        {/* Denomination ladder */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-24">
          {stampSheet.map((s) => (
            <div
              key={`tier-${s.theme}`}
              className="protocol-card p-4 border-zinc-800 bg-zinc-950/50"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-lg font-black gold-text">Concept design</span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300 mt-2">
                {s.theme}
              </p>
              {s.sub && (
                <p className="text-[9px] font-medium text-zinc-500 mt-1 leading-snug">
                  {s.sub}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Three experiences */}
        <div className="mb-24">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-6 text-center">
            The Phygital Mailbox Experience
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {experiences.map((exp) => (
              <div
                key={exp.title}
                className={`protocol-card p-8 ${exp.border}`}
                style={{
                  background: `linear-gradient(135deg, ${exp.glow} 0%, rgba(13,13,13,0.6) 60%)`,
                }}
              >
                <exp.icon className={`w-8 h-8 ${exp.color} mb-6`} />
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-2">
                  {exp.tag}
                </p>
                <h3 className="text-lg font-black uppercase tracking-tight mb-4">
                  {exp.title}
                </h3>
                <p className="text-zinc-400 text-xs leading-relaxed font-medium">
                  {exp.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Pitch to Postmaster */}
        <div
          className="protocol-card p-10 border-gold/30 mb-16"
          style={{
            background:
              'linear-gradient(135deg, rgba(201,162,39,0.10) 0%, rgba(13,13,13,0.7) 60%)',
          }}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-gold mb-3">
            Pitch to the Postmaster
          </p>
          <h2 className="text-3xl font-black uppercase tracking-tight mb-6">
            From delivery service to economic engine.
          </h2>
          <p className="text-zinc-300 text-base leading-relaxed font-medium max-w-3xl">
            QRON postcards don&apos;t replace philately — they extend it. Every Roscommon
            postcard sent ships a 3D micro-tour, a town-history exhibit, and a redeemable
            local coupon to the recipient&apos;s phone, with cryptographic proof of
            authenticity baked into the artwork itself. The Postal Service could capture the
            postcard sale, a sponsorship tier from local businesses on the landing page,
            and durable analytics on every scan — which could turn a single mailing
            into an ongoing local tourism and commerce channel, while the
            municipality gets measurable, targeted advertising delivered into living
            rooms across the country.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            {[
              { stat: '3', label: 'Proposed revenue streams (concept)' },
              { stat: '~25%', label: 'Scan lift vs plain QR' },
            ].map((s) => (
              <div
                key={s.label}
                className="p-4 rounded-xl bg-black/40 border border-gold/15"
              >
                <div className="text-2xl font-black gold-text">{s.stat}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <h3 className="text-2xl font-black uppercase tracking-tight mb-6">
            Interested in piloting a QRON postcard concept?
          </h3>
          <a
            href="mailto:partners@qron.space?subject=Roscommon%20Phygital%20Postcard%20Concept"
            className="btn-gold px-12 py-5 font-black uppercase tracking-widest text-xs shadow-gold inline-flex items-center gap-3"
          >
            Request Pilot Brief
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <p className="mt-12 text-center text-[11px] text-zinc-500">
          AuthiChain and QRON are not affiliated with or endorsed by the United States Postal Service.
        </p>
      </div>
    </div>
  );
}
