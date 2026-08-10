/**
 * Secure Verification Page — The Truth Layer for Consumers
 * Route: /verify/[tag]
 * Displays ProductDNA markers, Audio Stories, and Bitcoin L1 Proof.
 */
'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Shield, Play, Pause, CheckCircle, Database, Lock } from 'lucide-react'

export default function VerificationPage() {
  const { tag } = useParams()
  const [data, setData] = useState<any>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  // In real implementation, this would call your tRPC verification procedure
  useEffect(() => {
    // Mocking the verification data fetch
    setData({
      name: "Lion Labs Premium Extract",
      brand: "Lion Labs",
      status: "Authentic",
      inscribedAt: "2026-04-19",
      bitcoinBlock: "840291",
      markers: ["Trichome Density Match", "Seal Integrity Verified", "Color Profile Optimal"],
      audioUrl: "https://authichain.com/audio/sample-story.mp3"
    })
  }, [tag])

  const toggleAudio = () => {
    if (!data?.audioUrl) return
    if (!audio) {
      const newAudio = new Audio(data.audioUrl)
      newAudio.onended = () => setIsPlaying(false)
      setAudio(newAudio)
      newAudio.play()
      setIsPlaying(true)
    } else {
      if (isPlaying) {
        audio.pause()
      } else {
        audio.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  if (!data) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Verifying Truth Layer...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 pb-20">
      <div className="max-w-md mx-auto space-y-8 mt-10">
        
        {/* Header: Proof Badge */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-4 py-1.5 text-emerald-400 font-bold text-sm uppercase tracking-widest">
            <CheckCircle className="h-4 w-4" /> {data.status}
          </div>
          <h1 className="text-3xl font-extrabold">{data.name}</h1>
          <p className="text-slate-400">Secured by AuthiChain & Bitcoin L1</p>
        </div>

        {/* Audio Player: BrandVoice */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex items-center justify-between group hover:bg-white/10 transition-all cursor-pointer" onClick={toggleAudio}>
          <div className="space-y-1">
            <p className="text-xs text-blue-400 font-bold uppercase tracking-widest">Instant Brand Story</p>
            <p className="font-semibold">Hear the craft journey</p>
          </div>
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-600/20">
            {isPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white ml-1" />}
          </div>
        </div>

        {/* Verification Markers: ProductDNA */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-400" /> Visual Verification
          </h2>
          <div className="grid gap-3">
            {data.markers.map((marker: string) => (
              <div key={marker} className="bg-white/5 border border-white/5 p-4 rounded-xl flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-sm text-slate-300 font-medium">{marker}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Technical Proof: Bitcoin L1 */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm uppercase tracking-widest">
            <Lock className="h-4 w-4" /> Immutable Proof
          </div>
          <div className="space-y-2 font-mono text-xs text-amber-200/60">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span>Network</span>
              <span className="text-amber-100">Bitcoin L1 (Ordinals)</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span>Witness Block</span>
              <span className="text-amber-100">{data.bitcoinBlock}</span>
            </div>
            <div className="flex justify-between">
              <span>Inscribed At</span>
              <span className="text-amber-100">{data.inscribedAt}</span>
            </div>
          </div>
          <button className="w-full bg-amber-500 text-black font-bold py-3 rounded-xl text-sm hover:bg-amber-400 transition-colors">
            View on Bitcoin Explorer
          </button>
        </div>

      </div>

      <div className="fixed bottom-6 left-0 right-0 text-center text-[10px] text-slate-600 uppercase tracking-[0.2em] font-bold">
        AuthiChain Protocol &copy; 2026
      </div>
    </div>
  )
}
