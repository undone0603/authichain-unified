import type { Metadata } from 'next';
import Link from 'next/link';
import { 
  Shield, 
  ChevronLeft,
  Vote,
  CheckCircle2
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Active Proposals | GovChain Protocol DAO',
  description: 'View and vote on Protocol Improvement Proposals (PIPs) for the AuthiChain ecosystem.',
};

export default function GovChainProposals() {
  const proposals = [
    {
      title: 'Allocate 1M QRON for Creator Grants',
      id: 'PIP-042',
      status: 'Active',
      ends: '2d 4h',
      desc: 'Establish a new grant program to incentivize 3D and digital artists to build custom ControlNet models for the AuthiChain generator.'
    },
    {
      title: 'Increase Protocol Burn from 20% to 25%',
      id: 'PIP-043',
      status: 'Active',
      ends: '5d 12h',
      desc: 'Adjust the autonomous revenue recycling agent to utilize 25% of all enterprise API revenue for $QRON buybacks.'
    },
    {
      title: 'Integrate Base L2 for On-Chain Provenance',
      id: 'PIP-041',
      status: 'Executed',
      ends: 'Completed',
      desc: 'Transition the primary anchoring layer from Ethereum Mainnet to Base L2 to reduce industrial telemetry gas costs by 99%.'
    },
    {
      title: 'Ratify EU DPP Data Standard',
      id: 'PIP-040',
      status: 'Executed',
      ends: 'Completed',
      desc: 'Adopt the EU 2024/1789 standard for all digital product passports generated via the StrainChain gateway.'
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <header className="flex items-center justify-between mb-16 border-b border-zinc-900 pb-8">
            <Link href="/" className="group flex items-center gap-2">
                <ChevronLeft className="w-4 h-4 text-zinc-500 group-hover:text-gold transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white transition-colors">DAO Home</span>
            </Link>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-widest">
              <Vote className="w-3 h-3" />
              Protocol Improvement Proposals
            </div>
        </header>

        <h1 className="text-5xl md:text-7xl font-black mb-12 tracking-tighter uppercase leading-[0.9]">
          ACTIVE <br /> <span className="gold-text">PROPOSALS.</span>
        </h1>

        <div className="space-y-6 mt-12">
            {proposals.map(p => (
                <div key={p.id} className="protocol-card p-8 border-zinc-800 bg-zinc-950/50 hover:border-gold/30 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-[10px] font-black text-gold uppercase tracking-widest px-2 py-1 bg-gold/10 rounded">{p.id}</span>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${p.status === 'Active' ? 'text-blue-400' : 'text-green-400'}`}>
                                    {p.status === 'Active' ? `Ends in ${p.ends}` : 'Executed'}
                                </span>
                            </div>
                            <h3 className="text-2xl font-black uppercase tracking-tight">{p.title}</h3>
                        </div>
                        {p.status === 'Executed' ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <Vote className="w-6 h-6 text-zinc-600" />}
                    </div>
                    <p className="text-zinc-400 text-sm leading-relaxed max-w-3xl">
                        {p.desc}
                    </p>
                    {p.status === 'Active' && (
                        <div className="mt-6 flex gap-4">
                            <button className="btn-gold px-6 py-2 text-[10px] font-black uppercase tracking-widest shadow-gold">Vote For</button>
                            <button className="btn-outline-gold px-6 py-2 text-[10px] font-black uppercase tracking-widest border-zinc-800 text-zinc-400 hover:text-white">Vote Against</button>
                        </div>
                    )}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}