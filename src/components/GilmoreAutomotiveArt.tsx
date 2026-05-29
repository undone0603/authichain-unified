'use client'

import { useState } from 'react';
import { Car, Sparkles, Image as ImageIcon, CheckCircle, Loader2 } from 'lucide-react';

export default function GilmoreAutomotiveArt() {
  const [carModel, setCarModel] = useState('Duesenberg Model J');
  const [year, setYear] = useState('1929');
  const [style, setStyle] = useState<'classic_photo' | 'brushed_aluminum' | 'blueprint' | 'neon_night'>('classic_photo');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setResult(null);

    try {
      const res = await fetch('/api/industrial/gilmore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carModel,
          year,
          style,
          destinationUrl: 'https://gilmorecarmuseum.org/collection/featured'
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.qron);
      } else {
        alert(data.message || 'Generation failed');
      }
    } catch (error) {
      console.error("Gilmore generation failed", error);
      alert('Network error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 hover:border-gold/30 transition-all">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Car className="text-gold h-6 w-6" />
          <h2 className="text-xl font-black uppercase tracking-tight">Gilmore Automotive Art</h2>
        </div>
        <span className="text-[10px] px-2 py-1 rounded bg-gold/10 text-gold font-black uppercase tracking-widest">
          Theater 3: Industrial
        </span>
      </div>

      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Model</label>
            <input 
              type="text" 
              value={carModel}
              onChange={(e) => setCarModel(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-gold/50"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Year</label>
            <input 
              type="text" 
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-gold/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Artistic Style</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'classic_photo', label: 'Museum Photo' },
              { id: 'brushed_aluminum', label: 'Brushed Metal' },
              { id: 'blueprint', label: 'Technical Blueprint' },
              { id: 'neon_night', label: 'Cyber Neon' }
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setStyle(s.id as any)}
                className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  style === s.id 
                    ? 'bg-gold text-black' 
                    : 'bg-zinc-900 text-zinc-500 hover:text-white border border-zinc-800'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button 
        onClick={handleGenerate}
        disabled={isGenerating}
        className="btn-gold w-full py-3 rounded-xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] shadow-gold"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating Cinematic Art...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Museum QRON
          </>
        )}
      </button>

      {result && (
        <div className="mt-8 pt-8 border-t border-zinc-900">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="text-green-500 h-4 w-4" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Provenance Secured</span>
          </div>
          
          <div className="relative aspect-square rounded-xl overflow-hidden bg-white mb-4 group">
            <img 
              src={result.imageUrl} 
              alt="Automotive Art" 
              className="w-full h-full object-contain p-4"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-6 text-center">
              <p className="text-[10px] font-bold text-white uppercase tracking-widest leading-relaxed">
                Anchored to AuthiChain Core<br/>
                Verification ID: {result.id.slice(0, 8)}...
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
             <p className="text-[9px] font-bold text-zinc-500 uppercase mb-2">AI Artifact Narrative</p>
             <p className="text-[11px] text-zinc-400 italic leading-relaxed">
               "This {year} {carModel} capture at the Gilmore Car Museum fuses heritage engineering 
               with autonomous AI style, creating a cryptographically-sealed digital twin of 
               automotive history."
             </p>
          </div>
        </div>
      )}
    </div>
  );
}
