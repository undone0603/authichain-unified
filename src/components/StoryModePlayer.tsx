'use client';

import { useState, useRef } from 'react';
import { Play, Pause, Volume2, Maximize, Sparkles, Box, ShieldCheck, Loader2 } from 'lucide-react';

interface StoryModePlayerProps {
  videoUrl?: string;
  thumbnailUrl?: string;
  brandName: string;
  productName: string;
}

/**
 * AuthiChain AI StoryMode Player
 * 
 * Provides a high-fidelity cinematic interface for AI-generated brand narratives.
 */
export default function StoryModePlayer({ videoUrl, thumbnailUrl, brandName, productName }: StoryModePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const isProcessing = !videoUrl || videoUrl.includes('processing');

  return (
    <div 
      className="protocol-card mb-12 overflow-hidden bg-black group relative aspect-video shadow-2xl border-white/5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Atmosphere */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10 opacity-60" />
      
      {isProcessing ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6 z-20">
           <div className="relative">
              <Loader2 className="w-12 h-12 text-gold animate-spin" />
              <div className="absolute inset-0 blur-lg bg-gold/20 animate-pulse" />
           </div>
           <div className="text-center space-y-2">
              <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white">AI Story Rendering</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Synthesizing {brandName} Narrative...</p>
           </div>
        </div>
      ) : (
        <>
          <video 
            ref={videoRef}
            src={videoUrl}
            poster={thumbnailUrl}
            className="w-full h-full object-cover"
            loop
            muted
            playsInline
          />
          
          {/* HUD Overlay */}
          <div className={`absolute inset-0 z-20 transition-opacity duration-500 ${isHovered || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
            <div className="absolute top-6 left-6 flex items-center gap-3">
               <div className="w-8 h-8 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-gold" />
               </div>
               <div>
                  <p className="text-[8px] font-black text-gold uppercase tracking-widest leading-none mb-1">StoryMode Active</p>
                  <h4 className="text-xs font-black text-white uppercase tracking-tighter">{productName}</h4>
               </div>
            </div>

            <div className="absolute top-6 right-6">
               <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Verified Digital Twin</span>
               </div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
               <button 
                 onClick={togglePlay}
                 className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:scale-110 hover:bg-white/20 transition-all active:scale-95 group/play"
               >
                  {isPlaying ? (
                    <Pause className="w-8 h-8 text-white fill-white" />
                  ) : (
                    <Play className="w-8 h-8 text-white fill-white ml-1" />
                  )}
                  <div className="absolute inset-0 rounded-full border border-gold/40 scale-0 group-hover/play:scale-100 transition-transform duration-500" />
               </button>
            </div>

            <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
               <div className="space-y-1">
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Narrator</p>
                  <p className="text-xs font-bold text-white uppercase tracking-tighter">Autonomous AI Representative</p>
               </div>
               <div className="flex gap-4">
                  <Volume2 className="w-4 h-4 text-white opacity-40 hover:opacity-100 cursor-pointer transition-opacity" />
                  <Maximize className="w-4 h-4 text-white opacity-40 hover:opacity-100 cursor-pointer transition-opacity" />
               </div>
            </div>
          </div>
        </>
      )}

      {/* Frame Decoration */}
      <div className="absolute inset-0 border-[20px] border-black pointer-events-none z-30 opacity-40" />
    </div>
  );
}
