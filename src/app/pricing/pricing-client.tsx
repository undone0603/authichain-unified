'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useTryForFree } from '@/hooks/useTryForFree';

export function CheckoutModal({ 
  planId, 
  label, 
  paymentLink 
}: { 
  planId: string; 
  label: string; 
  price?: string; 
  paymentLink?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    if (paymentLink) {
      window.location.assign(paymentLink);
    } else {
      // Fallback to internal checkout api if link isn't provided
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId }),
        });
        const { url } = await res.json();
        if (url) window.location.assign(url);
      } catch (_err) {
        console.error('Checkout failed');
      }
    }
    setLoading(false);
  };

  const className = `w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${
    loading ? 'bg-zinc-800 text-zinc-500' : 'btn-gold shadow-gold'
  }`;

  // When a Stripe payment link exists, render a real anchor. This makes
  // checkout work even if a client-side error prevents React hydration (the
  // onClick handler would never fire in that case, but a plain <a> still
  // navigates). The fallback API-checkout path keeps the onClick button.
  if (paymentLink) {
    return (
      <a href={paymentLink} className={className} rel="noopener">
        {`Get ${label}`}
      </a>
    );
  }

  return (
    <button onClick={handleCheckout} disabled={loading} className={className}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Get ${label}`}
    </button>
  );
}

function TrialButtonInner() {
  const { startTrial, loading, error } = useTryForFree();
  const searchParams = useSearchParams();
  const autoStart = searchParams.get('startTrial') === '1';

  // Bounced back here (post-login) with intent to start a trial — finish the job.
  useEffect(() => {
    if (autoStart) startTrial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return (
    <div className="w-full">
      <button
        onClick={() => startTrial()}
        disabled={loading}
        className={`w-full py-4 rounded-xl border border-zinc-800 font-black uppercase tracking-widest text-xs text-center transition-colors flex items-center justify-center gap-2 ${
          loading ? 'text-zinc-600' : 'hover:bg-zinc-900'
        }`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Free'}
      </button>
      {error && (
        <p className="text-red-500 text-[10px] font-bold uppercase tracking-tight text-center mt-2">
          {error}
        </p>
      )}
    </div>
  );
}

export function TrialButton() {
  return (
    <Suspense
      fallback={
        <div className="w-full py-4 rounded-xl border border-zinc-800 font-black uppercase tracking-widest text-xs text-center text-zinc-600">
          Start Free
        </div>
      }
    >
      <TrialButtonInner />
    </Suspense>
  );
}
