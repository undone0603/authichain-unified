'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Globe, 
  Activity, 
  Shield, 
  ChevronLeft, 
  Zap, 
  MapPin,
  Clock
} from 'lucide-react';

import { createClient } from '@/utils/supabase/client';

interface ScanPulse {
  id: string;
  city: string;
  country: string;
  product: string;
  timestamp: string;
  lat: number;
  lng: number;
}

const CITY_COORDS: Record<string, { lat: number, lng: number }> = {
  'Paris': { lat: 48.8566, lng: 2.3522 },
  'New York': { lat: 40.7128, lng: -74.0060 },
  'Tokyo': { lat: 35.6762, lng: 139.6503 },
  'Dubai': { lat: 25.2048, lng: 55.2708 },
  'London': { lat: 51.5074, lng: -0.1278 },
  'Milan': { lat: 45.4642, lng: 9.1900 },
  'Singapore': { lat: 1.3521, lng: 103.8198 },
  'Los Angeles': { lat: 34.0522, lng: -118.2437 },
  'Berlin': { lat: 52.5200, lng: 13.4050 },
  'Shanghai': { lat: 31.2304, lng: 121.4737 }
};

export default function GlobalStatusMap() {
  const [pulses, setPulses] = useState<ScanPulse[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function fetchInitial() {
      const { data } = await supabase
        .from('scan_events')
        .select('*')
        .order('scanned_at', { ascending: false })
        .limit(10);
      
      if (data) {
        const formatted = data.map((s: any) => ({
          id: s.id.toString(),
          city: s.city || 'Unknown',
          country: s.country || '??',
          product: 'Verified Artifact',
          timestamp: s.scanned_at,
          lat: CITY_COORDS[s.city]?.lat || (30 + Math.random() * 10),
          lng: CITY_COORDS[s.city]?.lng || (Math.random() * 30)
        }));
        setPulses(formatted);
      }
    }
    fetchInitial();

    // Subscribe to new scans
    const channel = supabase
      .channel('realtime_scans')
      .on('postgres_changes', { event: 'INSERT', table: 'scan_events', schema: 'public' }, (payload) => {
        const s = payload.new as any;
        const newPulse: ScanPulse = {
          id: s.id.toString(),
          city: s.city || 'New Scan',
          country: s.country || '??',
          product: 'Protocol Pulse',
          timestamp: s.scanned_at,
          lat: CITY_COORDS[s.city]?.lat || (20 + Math.random() * 20),
          lng: CITY_COORDS[s.city]?.lng || (Math.random() * 100)
        };
        setPulses(prev => [newPulse, ...prev.slice(0, 9)]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden font-sans selection:bg-gold selection:text-black">
      {/* HUD Header */}
      <header className="fixed top-0 left-0 right-0 z-50 p-8 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto">
          <Link href="/admin" className="flex items-center gap-2 text-zinc-500 hover:text-gold transition-colors text-[10px] font-black uppercase tracking-widest mb-4">
            <ChevronLeft className="w-3 h-3" /> Dashboard
          </Link>
          <div className="space-y-1">
             <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                <h1 className="text-2xl font-black uppercase tracking-tighter italic">Global Truth <span className="text-zinc-600">Stream</span></h1>
             </div>
             <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">Real-time Verification Feed v2.4</p>
          </div>
        </div>

        <div className="text-right pointer-events-auto">
           <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-xl space-y-1">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Protocol Throughput</p>
              <p className="text-2xl font-black text-white font-mono">14.2 TPS</p>
              <div className="flex items-center gap-2 justify-end text-[9px] font-black text-emerald-500 uppercase tracking-tighter">
                 <Activity className="w-3 h-3" />
                 L2 Network Health: Optimal
              </div>
           </div>
        </div>
      </header>

      {/* Main Map Visual (Simplified 2D for fallback, high aesthetic) */}
      <main className="relative w-screen h-screen flex items-center justify-center">
        {/* Atmosphere */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(234,179,8,0.05)_0%,_transparent_70%)]" />
        <div className="absolute inset-0 bg-[url('/media/grid.svg')] opacity-[0.02] pointer-events-none" />
        
        {/* The "Globe" Visual Centerpiece */}
        <div className="relative w-[600px] h-[600px] md:w-[800px] md:h-[800px] rounded-full border border-white/5 flex items-center justify-center">
           <div className="absolute inset-0 rounded-full border border-white/[0.02] animate-ping opacity-20" style={{ animationDuration: '4s' }} />
           <div className="absolute inset-10 rounded-full border border-gold/10 blur-sm" />
           
           {/* Static World Map Outline (Simplified UI representation) */}
           <div className="w-[80%] h-[80%] opacity-20 grayscale invert">
              <Globe className="w-full h-full stroke-[0.5px]" />
           </div>

           {/* Live Pulses */}
           {pulses.map((pulse, i) => (
             <div 
               key={pulse.id}
               className="absolute transition-all duration-1000 ease-out"
               style={{
                 left: `${50 + (pulse.lng / 1.8)}%`,
                 top: `${50 - (pulse.lat / 0.9)}%`,
                 opacity: 1 - (i * 0.1)
               }}
             >
                <div className="relative">
                   <div className="w-3 h-3 bg-gold rounded-full animate-ping absolute -inset-0.5" />
                   <div className="w-2 h-2 bg-gold rounded-full shadow-[0_0_15px_rgba(234,179,8,0.8)]" />
                   
                   {i === 0 && (
                     <div className="absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap bg-black/80 border border-gold/40 px-3 py-1.5 rounded-lg backdrop-blur-md z-50">
                        <p className="text-[8px] font-black text-gold uppercase tracking-widest">{pulse.city}, {pulse.country}</p>
                        <p className="text-[10px] font-bold text-white">{pulse.product}</p>
                     </div>
                   )}
                </div>
             </div>
           ))}
        </div>
      </main>

      {/* Footer / Sidebar Status */}
      <aside className="fixed bottom-8 left-8 z-50 w-80 space-y-4">
         <div className="protocol-card bg-black/60 backdrop-blur-xl border-white/10 p-6 space-y-6">
            <div className="flex items-center gap-3">
               <Zap className="w-4 h-4 text-gold" />
               <h3 className="text-xs font-black uppercase tracking-widest">Recent Activity</h3>
            </div>
            
            <div className="space-y-4">
               {pulses.slice(0, 4).map((p) => (
                 <div key={p.id} className="flex gap-4 group">
                    <div className="w-px h-10 bg-zinc-800 relative">
                       <div className="absolute top-0 left-[-1px] w-1 h-3 bg-gold opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex-1">
                       <div className="flex justify-between items-start">
                          <p className="text-[10px] font-black text-white uppercase tracking-tighter">{p.city}</p>
                          <span className="text-[8px] font-mono text-zinc-600">{new Date(p.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                       </div>
                       <p className="text-[9px] font-bold text-zinc-500 uppercase">{p.product}</p>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         <div className="flex items-center gap-4 px-2">
            <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
               <span className="text-[8px] font-black uppercase text-zinc-600 tracking-widest text-white/40">Network Secure</span>
            </div>
            <div className="flex items-center gap-2">
               <Shield className="w-3 h-3 text-zinc-700" />
               <span className="text-[8px] font-black uppercase text-zinc-600 tracking-widest text-white/40">Polygon Mainnet</span>
            </div>
         </div>
      </aside>

      {/* Decoration */}
      <div className="fixed bottom-0 right-0 p-12 opacity-5 pointer-events-none">
         <Shield className="w-64 h-64 text-white" />
      </div>
    </div>
  );
}
