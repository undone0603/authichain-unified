'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

export function CheckoutModal({
  planId,
  label,
  paymentLink,
}: {
  planId: string;
  label: string;
  price?: string;
  paymentLink?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    if (paymentLink) {
      window.location.assign(paymentLink);
      return;
    }
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
      } else {
        setError(data.error || 'Checkout unavailable. Please try again.');
        setLoading(false);
      }
    } catch {
      setError('Could not connect. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <button
        onClick={handleCheckout}
        disabled={loading}
        className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${
          loading ? 'bg-zinc-800 text-zinc-500' : 'btn-gold shadow-gold'
        }`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Get ${label}`}
      </button>
      {error && (
        <p className="mt-2 text-center text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
