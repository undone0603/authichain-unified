'use client';

import { useState, useEffect, useCallback, startTransition } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { 
  Key, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  ShieldAlert,
  Loader2,
  Lock,
  Terminal,
  ChevronRight
} from 'lucide-react';

interface APIKey {
  id: string;
  name: string | null;
  key_prefix: string;
  created_at: string;
}

export function APIKeyManager({ userId }: { userId: string }) {
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copying, setCopying] = useState<string | null>(null);
  const [showQuickStart, setShowQuickStart] = useState(false);
  const supabase = createClient();

  const snippets = {
    curl: `curl -X POST https://qron.space/api/v1/generate \\
  -H "X-API-Key: ${newKey || 'YOUR_API_KEY'}" \\
  -d '{"url": "https://example.com", "prompt": "Liquid Gold"}'`,
    node: `const res = await fetch('https://qron.space/api/v1/generate', {
  method: 'POST',
  headers: {
    'X-API-Key': '${newKey || 'YOUR_API_KEY'}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://example.com',
    prompt: 'Liquid Gold'
  })
});`
  };

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error) setKeys((data || []) as APIKey[]);
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    startTransition(() => {
      fetchKeys();
    });
  }, [fetchKeys]);

  async function createKey() {
    setCreating(true);
    // In a real app, this would be a secure backend call to generate and hash the key
    // We'll call a hypothetical API endpoint
    try {
      const res = await fetch('/api/keys', { method: 'POST' });
      const data = await res.json();
      if (data.apiKey) {
        setNewKey(data.apiKey);
        fetchKeys();
      }
    } catch (_err) {
      console.error('Failed to create API key');
    }
    setCreating(false);
  }

  async function revokeKey(id: string) {
    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', id);

    if (!error) fetchKeys();
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopying(id);
    setTimeout(() => setCopying(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black uppercase tracking-tight">Industrial API Access</h3>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">
            Manage keys for programmatic QRON generation
          </p>
        </div>
        <button
          onClick={createKey}
          disabled={creating}
          className="btn-gold px-6 py-2 rounded-xl flex items-center gap-2 font-black uppercase tracking-widest text-[10px] shadow-gold disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Generate Key
        </button>
      </div>

      {newKey && (
        <div className="protocol-card p-6 bg-gold/10 border-gold/40 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3 mb-4 text-gold">
            <ShieldAlert className="w-5 h-5" />
            <h4 className="text-xs font-black uppercase tracking-widest">New Secret Key Generated</h4>
          </div>
          <p className="text-zinc-400 text-[10px] uppercase font-bold mb-4">
            Copy this key now. It will never be shown again for security reasons.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 bg-black p-4 rounded-xl border border-gold/20 font-mono text-gold text-sm break-all">
              {newKey}
            </code>
            <button
              onClick={() => copyToClipboard(newKey, 'new')}
              className="p-4 rounded-xl bg-gold text-black hover:bg-gold/80 transition-colors"
            >
              {copying === 'new' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <button 
            onClick={() => setNewKey(null)}
            className="mt-4 text-[10px] font-black uppercase text-zinc-500 hover:text-white"
          >
            I have saved this key
          </button>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-800" />
          </div>
        ) : keys.length === 0 ? (
          <div className="protocol-card p-12 text-center bg-zinc-900/20 border-zinc-900">
            <Key className="w-8 h-8 text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">
              No active API keys found
            </p>
          </div>
        ) : (
          keys.map((key) => (
            <div key={key.id} className="protocol-card p-6 flex justify-between items-center group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-tight text-white">
                    {key.name || 'Industrial Access Key'}
                  </h4>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-[10px] font-mono text-zinc-600">
                      Prefix: <span className="text-zinc-400">{key.key_prefix}...</span>
                    </p>
                    <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-tighter">
                      Created: {new Date(key.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => revokeKey(key.id)}
                  className="p-3 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-500 transition-colors"
                  title="Revoke Key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick Start for Developers */}
      <section className="pt-12 mt-12 border-t border-zinc-900">
          <button 
            onClick={() => setShowQuickStart(!showQuickStart)}
            className="flex items-center justify-between w-full group"
          >
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-zinc-500 group-hover:text-gold transition-colors" />
                <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400 group-hover:text-white transition-colors">
                    Developer Quick Start
                </h4>
              </div>
              <ChevronRight className={`w-4 h-4 text-zinc-700 transition-transform ${showQuickStart ? 'rotate-90' : ''}`} />
          </button>

          {showQuickStart && (
              <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-top-4">
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h5 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Example: cURL</h5>
                        <div className="bg-black rounded-xl p-6 font-mono text-[10px] leading-relaxed border border-zinc-900 text-zinc-400 relative group">
                            <pre className="whitespace-pre-wrap">{snippets.curl}</pre>
                            <button 
                                onClick={() => copyToClipboard(snippets.curl, 'curl')}
                                className="absolute right-4 top-4 p-2 bg-zinc-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                {copying === 'curl' ? <Check className="w-3 h-3 text-gold" /> : <Copy className="w-3 h-3" />}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h5 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Example: Node.js</h5>
                        <div className="bg-black rounded-xl p-6 font-mono text-[10px] leading-relaxed border border-zinc-900 text-zinc-400 relative group">
                            <pre className="whitespace-pre-wrap">{snippets.node}</pre>
                            <button 
                                onClick={() => copyToClipboard(snippets.node, 'node')}
                                className="absolute right-4 top-4 p-2 bg-zinc-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                {copying === 'node' ? <Check className="w-3 h-3 text-gold" /> : <Copy className="w-3 h-3" />}
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="protocol-card p-6 bg-gold/5 border-gold/10 flex items-center justify-between">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                        Need more? Explore the full Protocol Reference.
                    </p>
                    <Link href="/docs" className="text-[10px] font-black text-gold hover:underline uppercase tracking-widest">
                        View Docs &rarr;
                    </Link>
                </div>
              </div>
          )}
      </section>
    </div>
  );
}
