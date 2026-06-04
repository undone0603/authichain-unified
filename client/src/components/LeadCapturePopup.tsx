import { useState, useEffect, useCallback } from 'react';
import { X, Sparkles, ArrowRight } from 'lucide-react';

export function LeadCapturePopup() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    try { sessionStorage.setItem('ac_lead_dismissed', '1'); } catch {}
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('ac_lead_dismissed')) return;
      if (localStorage.getItem('ac_lead_captured')) return;
    } catch {}

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) setVisible(true);
    };
    const handleScroll = () => {
      const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight);
      if (pct > 0.5) setVisible(true);
    };

    const autoTimer = setTimeout(() => setVisible(true), 45000);
    const activateTimer = setTimeout(() => {
      document.addEventListener('mouseleave', handleMouseLeave);
      window.addEventListener('scroll', handleScroll, { passive: true });
    }, 8000);

    return () => {
      clearTimeout(autoTimer);
      clearTimeout(activateTimer);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      await fetch('/api/leads/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'popup',
          page_url: window.location.pathname,
          product_interest: 'authichain',
          utm_source: params.get('utm_source') || '',
          utm_medium: params.get('utm_medium') || '',
          utm_campaign: params.get('utm_campaign') || '',
        }),
      });
      setSubmitted(true);
      try { localStorage.setItem('ac_lead_captured', '1'); } catch {}
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 p-8 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl">
        <button onClick={dismiss} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors">
          <X className="h-5 w-5" />
        </button>

        {submitted ? (
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-yellow-500/10">
              <Sparkles className="h-8 w-8 text-yellow-500" />
            </div>
            <h3 className="text-2xl font-bold mb-2 text-white uppercase tracking-tighter">
              Welcome to AuthiChain!
            </h3>
            <p className="text-zinc-400 text-sm uppercase tracking-tight">
              The Truth Layer for the Global Economy. Get started now.
            </p>
            <a href="/login" className="inline-block mt-6 px-10 py-3 bg-yellow-500 text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-yellow-400 transition-colors">
              Enter AuthiChain
            </a>
          </div>
        ) : (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
              <Sparkles className="h-3 w-3" />
              Free Access
            </div>
            <h3 className="text-2xl font-bold mb-2 text-white uppercase tracking-tighter leading-none">
              Join the <br /><span className="text-yellow-500">AuthiChain</span> Protocol
            </h3>
            <p className="mb-6 text-zinc-500 text-xs font-bold uppercase tracking-tight leading-relaxed">
              Blockchain authentication for the physical world. Sign up free — $0.004 per seal.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                required
                placeholder="Enterprise Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 text-sm bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500/50 transition-colors"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-4 bg-yellow-500 text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-yellow-400 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Initializing...' : 'Get AuthiChain Access'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>
            <p className="text-xs mt-6 text-center text-zinc-600 uppercase tracking-widest font-bold">
              AuthiChain Protocol · Secure · Verifiable
            </p>
          </>
        )}
      </div>
    </div>
  );
}
