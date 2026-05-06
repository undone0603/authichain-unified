import type { Metadata } from 'next';
import Link from 'next/link';
import { 
  ShieldCheck, 
  AlertTriangle,
  ArrowRight,
  Shield,
  FileText,
  Lock,
  Play
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'FTC Made in USA Shield | AuthiChain Protocol',
  description: 'Instantly verify your "Made in USA" claims. Protect your brand from the FTC sweep (EO 14392) with cryptographically anchored origin proofs.',
};

export default function FtcShieldPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-red-500/5 blur-[120px] rounded-full opacity-50 pointer-events-none" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-[0.2em] mb-8">
            <AlertTriangle className="w-4 h-4" />
            URGENT: FTC ENFORCEMENT SWEEP ACTIVE (EO 14392)
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter uppercase leading-[0.9]">
            PROVE IT&apos;S <br />
            <span className="text-red-500">MADE IN USA.</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-zinc-400 text-lg md:text-xl font-medium mb-12 leading-relaxed">
            The FTC is cracking down on unverified origin claims. Turn your packaging into an irrefutable, blockchain-anchored shield that proves your American supply chain instantly.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard" className="bg-red-600 hover:bg-red-500 text-white inline-flex items-center justify-center gap-3 px-12 py-5 rounded-xl font-black uppercase tracking-widest text-xs transition-colors">
              Secure Your Brand <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/docs" className="btn-outline-gold border-zinc-800 text-zinc-300 inline-flex items-center justify-center gap-3 px-12 py-5 font-black uppercase tracking-widest text-xs">
              View Legal Spec <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Video Demo (The Patriot's Shield) */}
        <div className="max-w-4xl mx-auto mt-20 relative rounded-3xl overflow-hidden border border-zinc-800 bg-zinc-950 aspect-video md:aspect-[21/9]">
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 group cursor-pointer hover:bg-black/40 transition-colors z-10">
                <div className="w-20 h-20 rounded-full bg-red-600/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="w-8 h-8 text-white ml-2" />
                </div>
            </div>
            {/* Fallback to static if video is not loaded yet */}
            <div className="absolute inset-0 bg-[url('/media/usa/patriotic-pride-unleashed-honoring-the-red-white-and-blue-with-qr-code-tank-art-artvizual.jpg')] bg-cover bg-center opacity-40 blur-sm" />
            <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black to-transparent z-20">
                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Demo: The Patriot&apos;s Shield</p>
                <p className="text-xl font-black uppercase tracking-tight">Instant Origin Verification</p>
            </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-black uppercase tracking-tight text-center mb-16">
          The <span className="text-red-500">Ultimate Defense</span> Against False Claims
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { 
              icon: ShieldCheck, 
              title: 'Immutable Evidence', 
              desc: 'Log your US-based manufacturing stages. Data is hashed and anchored to Polygon, making it tamper-proof against any audit.' 
            },
            { 
              icon: FileText, 
              title: 'Instant Compliance', 
              desc: 'Consumers and regulators scan your product to instantly see the full chain of custody, backing up your "Made in USA" labels.' 
            },
            { 
              icon: Lock, 
              title: 'Ed25519 Security', 
              desc: 'Every scan verifies the cryptographic signature of the original factory node, completely eliminating counterfeiting risks.' 
            },
          ].map((item, i) => (
            <div key={i} className="protocol-card p-8 group hover:border-red-500/30 transition-all border-zinc-900 bg-zinc-950/50">
              <item.icon className="w-8 h-8 text-red-500 mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-black uppercase tracking-tight mb-3 text-white">{item.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed uppercase tracking-tighter">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-zinc-900 mt-20">
        <div className="max-w-6xl mx-auto text-center opacity-40 flex items-center justify-center gap-3">
          <Shield className="w-4 h-4 text-zinc-500" />
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            &copy; 2026 AuthiChain Protocol ◆ Legal &amp; Compliance Operations
          </p>
        </div>
      </footer>
    </div>
  );
}
