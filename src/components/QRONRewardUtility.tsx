'use client';
import { Coins, Trophy, Lock, ArrowRight, Zap, ExternalLink, AlertCircle, Camera, CheckCircle2, Flame } from 'lucide-react';
import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function QRONRewardUtility({ productId }: { productId: number }) {
  const [claimed, setClaimed] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isVerifyingPhoto, setIsVerifyingPhoto] = useState(false);
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const claimMutation = trpc.qron.claimReward.useMutation({
    onSuccess: (data) => {
      setClaimed(true);
      setTxHash(`PENDING-${Date.now().toString(16)}`);
      toast.success(`Claimed ${data.claimedAmount} QRON! Assigned to ${data.agentName}.`);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to claim reward');
    }
  });

  const burnMutation = trpc.qron.burnForDiscount.useMutation({
    onSuccess: (data) => {
      setDiscountCode(data.discountCode);
      toast.success(data.message);
    },
    onError: (err) => {
      toast.error(err.message || 'Redemption failed');
    }
  });

  const verifyPhotoMutation = trpc.qron.verifyPhoto.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
      setIsVerifyingPhoto(false);
    },
    onError: (err) => {
      toast.error(err.message || 'Verification failed');
      setIsVerifyingPhoto(false);
    }
  });

  async function handleClaim() {
    claimMutation.mutate({
      productId: productId || 1, 
      rewardType: 'standard_scan',
      amount: 10
    });
  }

  async function handleRedeem() {
    burnMutation.mutate({
      amount: 50
    });
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsVerifyingPhoto(true);
    toast.info("Uploading proof to the Truth Layer...");

    setTimeout(() => {
      verifyPhotoMutation.mutate({
        productId: productId || 1,
        imageUrl: "https://authichain.com/placeholder-proof.jpg"
      });
    }, 1500);
  }

  return (
    <div className="protocol-card p-8 border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Coins className="w-24 h-24 text-emerald-400 rotate-12" />
      </div>

      <div className="flex items-center gap-3 mb-8 relative z-10">
        <Trophy className="w-5 h-5 text-emerald-400" />
        <h2 className="text-sm font-black uppercase tracking-widest text-white">
          Active Quests & Rewards
        </h2>
      </div>

      <div className="space-y-6 relative z-10">
        {/* Base Scan Reward */}
        <div className="flex items-center justify-between bg-black/40 p-5 rounded-2xl border border-emerald-500/20 backdrop-blur-sm">
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-tighter mb-1">Standard Authentication</h4>
            <p className="text-[10px] text-zinc-500 font-bold uppercase">Reward: 10 $QRON</p>
          </div>
          {claimed ? (
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-emerald-400 uppercase mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Claimed
              </span>
              <div className="text-[8px] font-mono text-zinc-600">ID: {txHash}</div>
            </div>
          ) : (
            <button 
              onClick={handleClaim}
              disabled={claimMutation.isPending}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 text-black px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
            >
              {claimMutation.isPending ? 'Processing...' : 'Claim 10 QRON'}
            </button>
          )}
        </div>

        {claimMutation.isError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-[10px] text-red-400 font-bold uppercase tracking-tight leading-tight">
              {claimMutation.error.message}
            </p>
          </div>
        )}

        {/* Chapter Progress */}
        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h4 className="text-xs font-black text-zinc-300 uppercase tracking-tighter mb-1">Living Chapter Progress</h4>
              <p className="text-[10px] text-zinc-500 font-bold uppercase italic">Chapter 1: The Origin (Active)</p>
            </div>
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">4 / 5 Scans</span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 w-[80%] shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Lock className="w-3 h-3 text-zinc-700" />
            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-tight">Chapter 2 unlocks at 5 verified scans</p>
          </div>
        </div>

        {/* Community Verification */}
        <div 
          className="group cursor-pointer relative"
          onClick={() => !isVerifyingPhoto && fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handlePhotoUpload}
          />
          <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/0 hover:border-emerald-500/60 hover:bg-emerald-500/5 transition-all">
            <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center border border-zinc-800 group-hover:border-emerald-500/30">
              {isVerifyingPhoto ? (
                <Zap className="w-5 h-5 text-emerald-400 animate-pulse" />
              ) : (
                <Camera className="w-5 h-5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
              )}
            </div>
            <div className="flex-1">
              <h5 className="text-[10px] font-black text-zinc-400 group-hover:text-white uppercase tracking-tighter">Community Proof Quest</h5>
              <p className="text-[9px] text-zinc-600 font-medium leading-tight">
                {isVerifyingPhoto ? 'AI Analyzing Photo Proof...' : 'Verify this artifact in the wild for a '}
                {!isVerifyingPhoto && <span className="text-emerald-500/80 font-black">20 QRON</span>}
                {!isVerifyingPhoto && ' bonus.'}
              </p>
            </div>
            {isVerifyingPhoto ? (
               <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4 text-zinc-800 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            )}
          </div>
        </div>

        {/* Burn Utility */}
        <div className="pt-4 border-t border-zinc-800/50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Utility & Burn</h4>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black text-emerald-500/80 uppercase">Layer 2 Siphon Active</span>
            </div>
          </div>
          
          {discountCode ? (
            <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-xl text-center space-y-2">
               <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest flex items-center justify-center gap-2">
                  <Flame className="w-3 h-3" /> Discount Activated
               </p>
               <p className="text-2xl font-black text-white tracking-widest font-mono select-all">{discountCode}</p>
               <p className="text-[9px] text-zinc-500 font-bold uppercase italic">Apply at checkout to save</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div 
                onClick={handleRedeem}
                className={`bg-black/60 p-3 rounded-xl border border-zinc-800 text-center transition-all cursor-pointer ${burnMutation.isPending ? 'opacity-50' : 'hover:border-orange-500/40 hover:bg-orange-500/5 group'}`}
              >
                <p className="text-[9px] font-black text-zinc-400 group-hover:text-orange-400 uppercase mb-1">Burn for Discount</p>
                <p className="text-xs font-black text-white uppercase">{burnMutation.isPending ? 'Burning...' : '20% OFF'}</p>
                <p className="text-[8px] text-zinc-600 font-bold mt-1 uppercase tracking-tighter group-hover:text-orange-900">Requires 50 QRON</p>
              </div>
              <div className="bg-black/60 p-3 rounded-xl border border-zinc-800 text-center hover:border-gold/30 transition-colors cursor-pointer opacity-50">
                <p className="text-[9px] font-black text-zinc-400 uppercase mb-1">Exclusive Chapter</p>
                <p className="text-xs font-black text-white uppercase">UNLOCKED</p>
                <p className="text-[8px] text-zinc-600 font-bold mt-1 uppercase tracking-tighter">Founders Circle Only</p>
              </div>
            </div>
          )}
        </div>

        <button className="w-full flex items-center justify-center gap-2 text-[10px] font-black text-zinc-600 hover:text-white uppercase tracking-[0.2em] pt-2 transition-colors">
          View Global Rankings <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
