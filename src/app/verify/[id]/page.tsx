import { CheckCircle2, Shield, Box, Link as LinkIcon } from 'lucide-react';

export default function VerificationPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      
      {/* 2.1-Second Resolution Header */}
      <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-2">Authentic Origin</h1>
        <p className="text-zinc-400 font-mono text-sm">Hash: 0x8f4b2c1...{params.id.substring(0, 4)}</p>
      </div>

      {/* Digital Twin Display */}
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-8 shadow-2xl">
        <div className="aspect-square bg-zinc-950 relative flex items-center justify-center">
           {/* WebGL/3D Texture render goes here */}
           <Box className="w-16 h-16 text-zinc-800" />
           <div className="absolute bottom-4 left-4 right-4 flex justify-between text-xs font-mono text-zinc-500">
              <span>Digital Twin</span>
              <span>Matched</span>
           </div>
        </div>
        
        {/* Consensus Log */}
        <div className="p-5 border-t border-zinc-800 bg-black/50">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
            <Shield className="w-3 h-3" /> System Log
          </h3>
          <ul className="space-y-2 text-xs font-mono text-zinc-400">
            <li className="flex justify-between"><span>Edge Validation:</span> <span className="text-green-400">1.8s</span></li>
            <li className="flex justify-between"><span>Vision Consensus:</span> <span>Passed (5/5)</span></li>
            <li className="flex justify-between"><span>ERC-721 Status:</span> <span>Anchored</span></li>
          </ul>
        </div>
      </div>

      {/* Ecosystem Call-to-Action Footer */}
      <div className="mt-8 text-center">
        <p className="text-zinc-500 text-sm mb-4">Secured by the AuthiChain Protocol</p>
        <button className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-full text-xs font-medium border border-zinc-800 transition-colors">
          <LinkIcon className="w-3 h-3 text-gold" />
          View BTC Ordinal Anchor
        </button>
      </div>
    </div>
  );
}
