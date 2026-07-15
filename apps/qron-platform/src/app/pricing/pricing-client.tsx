'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

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

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${
        loading ? 'bg-zinc-800 text-zinc-500' : 'btn-gold shadow-gold'
      }`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Get ${label}`}
    </button>
  );
}
