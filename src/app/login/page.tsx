'use client';

import React, { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Shield, Sparkles, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const hasSupabaseEnv =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const supabase = hasSupabaseEnv ? createClient() : null;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Authentication is temporarily unavailable.');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="protocol-card relative w-full max-w-md mx-4 p-10 shadow-2xl overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gold glow-gold opacity-50" />

        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-full bg-gold/10 border border-gold/20">
              <Shield className="w-8 h-8 text-gold" />
            </div>
          </div>
          <h1 className="text-4xl font-black gold-text mb-2 tracking-tight">
            AUTHENTICATE
          </h1>
          <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">
            AuthiChain Protocol Gate
          </p>
        </div>

        {sent ? (
          <div className="text-center p-8 rounded-xl bg-gold/5 border border-gold/20">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 bg-green-500/10">
              <Sparkles className="h-6 w-6 text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Check Email</h3>
            <p className="text-zinc-400 text-sm">
              We&apos;ve sent a magic link to <strong className="text-gold">{email}</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-zinc-600 uppercase mb-2 ml-1">
                Registry Email
              </label>
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="protocol-input w-full px-4 py-3 text-white"
              />
            </div>

            {error && (
              <p className="text-red-500 text-xs font-medium text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !supabase}
              className="btn-gold w-full py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold"
            >
              {loading ? 'Processing...' : 'Access My QRONs'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>

            <p className="text-[10px] text-zinc-600 text-center uppercase tracking-tighter mt-6">
              By continuing, you agree to the AuthiChain Protocol Terms of Service
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
