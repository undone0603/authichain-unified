import type { Metadata } from 'next';
import Link from 'next/link';
import { 
  Shield, 
  ChevronLeft,
  PieChart,
  Flame,
  ArrowRight
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Tokenomics | GovChain Protocol DAO',
  description: 'Detailed breakdown of $QRON tokenomics, staking yields, and the deflationary burn mechanism.',
};

export default function GovChainTokenomics() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <header className="flex items-center justify-between mb-16 border-b border-zinc-900 pb-8">
            <Link href="/" className="group flex items-center gap-2">
                <ChevronLeft className="w-4 h-4 text-zinc-500 group-hover:text-gold transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors">DAO Home</span>
            </Link>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-widest">
              <PieChart className="w-3 h-3" />
              Protocol Economics
            </div>
        </header>

        <h1 className="text-5xl md:text-7xl font-black mb-12 tracking-tighter uppercase leading-[0.9]">
          $QRON <br /> <span className="gold-text">TOKENOMICS.</span>
        </h1>

        <p className="max-w-2xl text-zinc-400 text-lg font-medium mb-16 leading-relaxed">
            The $QRON token is the economic engine of the AuthiChain ecosystem. It aligns the incentives of node operators, brands, and the community to secure the visual internet.
        </p>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="protocol-card p-8 border-zinc-800 bg-zinc-950/50">
              <PieChart className="w-8 h-8 text-gold mb-6" />
              <h3 className="text-xl font-black uppercase tracking-tight mb-4">Supply Distribution</h3>
              <ul className="space-y-3 text-sm text-zinc-400">
                  <li className="flex justify-between border-b border-zinc-900 pb-2"><span>Community Treasury</span> <span className="text-white font-bold">40%</span></li>
                  <li className="flex justify-between border-b border-zinc-900 pb-2"><span>Node Operators</span> <span className="text-white font-bold">30%</span></li>
                  <li className="flex justify-between border-b border-zinc-900 pb-2"><span>Core Contributors</span> <span className="text-white font-bold">15%</span></li>
                  <li className="flex justify-between border-b border-zinc-900 pb-2"><span>Ecosystem Grants</span> <span className="text-white font-bold">15%</span></li>
              </ul>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mt-6">Fixed Supply: 100M $QRON</p>
            </div>
            
            <div className="protocol-card p-8 border-zinc-800 bg-zinc-950/50">
              <Flame className="w-8 h-8 text-red-500 mb-6" />
              <h3 className="text-xl font-black uppercase tracking-tight mb-4">Deflationary Burn</h3>
              <p className="text-zinc-500 text-sm leading-relaxed font-medium uppercase tracking-tighter mb-6">
                25% of all fiat revenue generated from enterprise API calls and white-label SDK licensing is autonomously routed to buy back and burn $QRON tokens on the open market.
              </p>
              <Link href="/governance" className="text-[10px] font-black text-red-400 uppercase hover:underline flex items-center gap-1">
                  View Burn Dashboard <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
        </div>
      </div>
    </div>
  );
}