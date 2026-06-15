import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Shield, Play, Pause, CheckCircle, Lock, AlertTriangle, Loader2 } from "lucide-react";

export default function Verify({ productId }: { productId: string }) {
  const numericId = parseInt(productId, 10);
  const isValidId = !isNaN(numericId) && numericId > 0;

  const { data, isLoading, error } = trpc.qrcode.scan.useQuery(
    { productId: numericId },
    { enabled: isValidId }
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const toggleAudio = () => {
    const url = data?.product?.audioUrl;
    if (!url) return;
    if (!audio) {
      const a = new Audio(url);
      a.onended = () => setIsPlaying(false);
      setAudio(a);
      a.play();
      setIsPlaying(true);
    } else {
      if (isPlaying) { audio.pause(); } else { audio.play(); }
      setIsPlaying(!isPlaying);
    }
  };

  if (!isValidId || error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto" />
          <h1 className="text-2xl font-extrabold text-white">Invalid Verification Link</h1>
          <p className="text-slate-400 text-sm">
            This QR code could not be verified. It may be expired, revoked, or malformed.
          </p>
          <p className="text-slate-600 text-xs font-mono">ID: {productId}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mx-auto" />
          <p className="text-slate-400 text-sm">Verifying Truth Layer...</p>
        </div>
      </div>
    );
  }

  const product = data?.product;
  if (!product) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto" />
          <h1 className="text-2xl font-extrabold text-white">Invalid Verification Link</h1>
          <p className="text-slate-400 text-sm">No product found for this QR code.</p>
        </div>
      </div>
    );
  }

  const isAuthentic = product.status === "active";
  const markers: string[] = Array.isArray(product.visionMarkers) ? product.visionMarkers as string[] : [];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 pb-20">
      <div className="max-w-md mx-auto space-y-8 mt-10">

        {/* Header */}
        <div className="text-center space-y-4">
          <div className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-bold text-sm uppercase tracking-widest ${
            isAuthentic
              ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
              : "bg-red-500/20 border border-red-500/30 text-red-400"
          }`}>
            <CheckCircle className="h-4 w-4" />
            {isAuthentic ? "Authentic" : product.status ?? "Unknown"}
          </div>
          <h1 className="text-3xl font-extrabold">{product.name}</h1>
          {product.brand && <p className="text-slate-400">{product.brand}</p>}
          <p className="text-slate-500 text-xs">Secured by AuthiChain &amp; Bitcoin L1</p>
        </div>

        {/* Audio Player */}
        {product.audioUrl && (
          <div
            className="bg-white/5 border border-white/10 rounded-3xl p-6 flex items-center justify-between hover:bg-white/10 transition-all cursor-pointer"
            onClick={toggleAudio}
          >
            <div className="space-y-1">
              <p className="text-xs text-blue-400 font-bold uppercase tracking-widest">Instant Brand Story</p>
              <p className="font-semibold">Hear the craft journey</p>
            </div>
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-600/20">
              {isPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white ml-1" />}
            </div>
          </div>
        )}

        {/* Vision Markers */}
        {markers.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-400" /> Visual Verification
            </h2>
            <div className="grid gap-3">
              {markers.map((marker) => (
                <div key={marker} className="bg-white/5 border border-white/5 p-4 rounded-xl flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="text-sm text-slate-300 font-medium">{marker}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Blockchain Proof */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm uppercase tracking-widest">
            <Lock className="h-4 w-4" /> Immutable Proof
          </div>
          <div className="space-y-2 font-mono text-xs text-amber-200/60">
            {product.blockchainTxHash && (
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span>Tx Hash</span>
                <span className="text-amber-100 truncate max-w-[160px]">{product.blockchainTxHash}</span>
              </div>
            )}
            {product.serialNumber && (
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span>Serial</span>
                <span className="text-amber-100">{product.serialNumber}</span>
              </div>
            )}
            {product.batchNumber && (
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span>Batch</span>
                <span className="text-amber-100">{product.batchNumber}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Scans</span>
              <span className="text-amber-100">{data?.scanCount ?? 1}</span>
            </div>
          </div>
        </div>

      </div>

      <div className="fixed bottom-6 left-0 right-0 text-center text-[10px] text-slate-600 uppercase tracking-[0.2em] font-bold">
        AuthiChain Protocol &copy; 2026
      </div>
    </div>
  );
}
