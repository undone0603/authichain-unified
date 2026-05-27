'use client';
import { useState } from 'react';
import { Wand2, Hexagon, Anchor } from 'lucide-react';

export default function QronStudio() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Placeholder for edge-generated variants
  const variants = [1, 2, 3, 4];

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">QronSpace Studio</h1>
        <p className="text-zinc-400">Deploy thematic, AI-generated identities via the Edge Network.</p>
      </header>

      {/* Prompt-to-Texture Engine */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-12">
        <label className="block text-sm font-medium text-gold mb-3 uppercase tracking-widest">
          Aesthetic Definition
        </label>
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="e.g., Matte black carbon fiber with gold foil accents..."
            className="flex-1 bg-black border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button 
            onClick={() => setIsGenerating(true)}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 border border-zinc-700 transition-colors"
          >
            <Wand2 className="w-4 h-4 text-gold" />
            Generate via Edge
          </button>
        </div>
      </div>

      {/* Instant Preview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {variants.map((v) => (
          <div key={v} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col">
            <div className="aspect-square bg-zinc-900 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden group">
               {isGenerating ? (
                 <div className="text-zinc-600 animate-pulse flex flex-col items-center">
                    <Hexagon className="w-8 h-8 mb-2 animate-spin" />
                    <span className="text-xs font-mono">Awaiting Consensus...</span>
                 </div>
               ) : (
                 <div className="text-zinc-700 font-mono text-xs">Preview {v}</div>
               )}
            </div>
            <button className="mt-auto w-full bg-black hover:bg-zinc-900 text-white border border-zinc-800 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
              <Anchor className="w-4 h-4 text-gold" />
              Anchor & Deploy
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
