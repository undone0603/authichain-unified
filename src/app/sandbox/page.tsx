import ARHousingViewer from '../../components/ARHousingViewer';
import AgenticCloser from '../../components/AgenticCloser';
import { ShieldCheck, Cpu, Link as LinkIcon } from 'lucide-react';

export default function SandboxPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-300 font-sans selection:bg-emerald-500/30">
      <header className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <span className="font-bold text-lg tracking-widest text-white uppercase">AuthiChain <span className="text-zinc-600">Protocol</span></span>
          </div>
          <div className="text-xs font-mono px-3 py-1 bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 rounded-full">LIVE SANDBOX ENVIRONMENT</div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-7 space-y-8">
          <div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">The &quot;Digital Twin&quot; <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">Provenance Anchor</span></h1>
            <p className="text-lg text-zinc-400 max-w-2xl leading-relaxed">Welcome to your private sandbox. Below is a live WebXR render of our &quot;Missing Middle&quot; architectural integration. We are mapping blockchain-verified QRON data to physical spaces. No apps required.</p>
          </div>
          <div className="p-1 bg-gradient-to-br from-zinc-800 to-zinc-950 rounded-2xl shadow-2xl">
            <ARHousingViewer projectName="Roscommon Pilot" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
              <Cpu className="w-6 h-6 text-zinc-400 mb-2" />
              <h4 className="text-white font-bold mb-1">WebXR Native</h4>
              <p className="text-sm text-zinc-500">Built on @react-three/fiber. Ready for Zapbox physical tracking.</p>
            </div>
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
              <LinkIcon className="w-6 h-6 text-zinc-400 mb-2" />
              <h4 className="text-white font-bold mb-1">On-Chain Data</h4>
              <p className="text-sm text-zinc-500">Anchored to Polygon. Immutable material verification.</p>
            </div>
          </div>
        </div>
        <div className="lg:col-span-5 relative">
          <div className="sticky top-24 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Initialize Integration</h2>
              <p className="text-sm text-zinc-400">Skip the sales call. Speak directly with AgentZ to review API documentation, request the Zappar integration specs, or initialize a $199 Single-Project Pilot immediately.</p>
            </div>
            <AgenticCloser />
            <div className="text-center"><p className="text-xs text-zinc-600 font-mono">Powered by AuthiChain Autonomous Logic</p></div>
          </div>
        </div>
      </main>
    </div>
  );
}
