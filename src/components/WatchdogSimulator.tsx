'use client'

import { useState } from 'react';
import { AlertTriangle, ThermometerSun, ShieldCheck } from 'lucide-react';

export default function WatchdogSimulator() {
  const [temperature, setTemperature] = useState(70);
  const [humidity, setHumidity] = useState(50);
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const triggerTelemetry = async () => {
    setIsSimulating(true);
    setResult(null);

    try {
      const res = await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrcTag: '1A405030002934D000000123', // Demo Batch
          temperature: temperature,
          humidity: humidity,
          gpsLocation: '42.3314,-83.0458', // Detroit Coordinates
          timestamp: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error("Simulation failed", error);
    } finally {
      setIsSimulating(false);
    }
  };

  const isBreach = temperature > 75 || humidity > 60;

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 hover:border-gold/30 transition-all shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <ThermometerSun className="text-amber-500 h-6 w-6" />
          <h2 className="text-xl font-black uppercase tracking-tight">Live Transport: Fleet 04</h2>
        </div>
        <span className="text-[10px] px-2 py-1 rounded bg-zinc-900 text-zinc-500 font-black uppercase tracking-widest border border-zinc-800">
          Theater 1: AgTech
        </span>
      </div>

      {/* Control Sliders */}
      <div className="space-y-6 mb-6">
        <div>
          <label className="flex justify-between text-sm text-zinc-400 mb-2">
            <span>Container Temperature</span>
            <span className={temperature > 75 ? 'text-red-400 font-bold' : 'text-zinc-100'}>{temperature}°F</span>
          </label>
          <input 
            type="range" min="60" max="90" value={temperature} 
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
        </div>
        
        <div>
          <label className="flex justify-between text-sm text-zinc-400 mb-2">
            <span>Relative Humidity</span>
            <span className={humidity > 60 ? 'text-red-400 font-bold' : 'text-zinc-100'}>{humidity}%</span>
          </label>
          <input 
            type="range" min="30" max="80" value={humidity} 
            onChange={(e) => setHumidity(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>
      </div>

      {/* Execution Button */}
      <button 
        onClick={triggerTelemetry}
        disabled={isSimulating}
        className={`w-full py-3 rounded font-bold transition-all ${
          isBreach 
            ? 'bg-red-600 hover:bg-red-500 text-white' 
            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
        }`}
      >
        {isSimulating ? 'TRANSMITTING EDGE DATA...' : 'SIMULATE SENSOR PING'}
      </button>

      {/* Autonomous Result Output */}
      {result && (
        <div className={`mt-6 p-4 rounded border ${result.compliant ? 'bg-emerald-950/30 border-emerald-900/50' : 'bg-red-950/30 border-red-900/50'}`}>
          <div className="flex items-center gap-2 mb-2">
            {result.compliant ? <ShieldCheck className="text-emerald-500 h-5 w-5"/> : <AlertTriangle className="text-red-500 h-5 w-5"/>}
            <span className={`font-bold ${result.compliant ? 'text-emerald-400' : 'text-red-400'}`}>
              {result.compliant ? 'CRA COMPLIANT' : 'COMPLIANCE BREACH DETECTED'}
            </span>
          </div>
          
          {!result.compliant && (
            <div className="mt-3 text-xs font-mono space-y-1">
              <p className="text-zinc-400">Ledger Anchor Initiated...</p>
              <p className="text-purple-400 break-all">TX: {result.blockchainTx}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
