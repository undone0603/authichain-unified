import { useState, useEffect, useCallback } from 'react';
import { Key, Plus, Trash2, Copy, Check, ShieldAlert, Loader2, Lock, Terminal, ChevronRight } from 'lucide-react';

interface APIKey {
  id: string;
  name: string | null;
  key_prefix: string;
  created_at: string;
}

export function APIKeyManager({ userId: _userId }: { userId: string }) {
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copying, setCopying] = useState<string | null>(null);
  const [showQuickStart, setShowQuickStart] = useState(false);

  const snippets = {
    curl: `curl -X POST https://authichain.com/api/v1/authenticate \\
  -H "X-API-Key: ${newKey || 'YOUR_API_KEY'}" \\
  -d '{"product_id": "SKU-001", "serial": "SN-ABC123"}'`,
    node: `const res = await fetch('https://authichain.com/api/v1/authenticate', {
  method: 'POST',
  headers: {
    'X-API-Key': '${newKey || 'YOUR_API_KEY'}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ product_id: 'SKU-001', serial: 'SN-ABC123' })
});`,
  };

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/keys');
      const data = await res.json();
      setKeys(data || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  async function createKey() {
    setCreating(true);
    try {
      const res = await fetch('/api/keys', { method: 'POST' });
      const data = await res.json();
      if (data.apiKey) { setNewKey(data.apiKey); fetchKeys(); }
    } catch { /* silent */ }
    setCreating(false);
  }

  async function revokeKey(id: string) {
    await fetch(`/api/keys/${id}`, { method: 'DELETE' });
    fetchKeys();
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
          <h3 className="text-lg font-black uppercase tracking-tight text-white">API Access</h3>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">
            Manage keys for programmatic authentication
          </p>
        </div>
        <button
          onClick={createKey}
          disabled={creating}
          className="px-6 py-2 rounded-xl flex items-center gap-2 font-black uppercase tracking-widest text-xs bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-50 transition-colors"
        >
          {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Generate Key
        </button>
      </div>

      {newKey && (
        <div className="p-6 rounded-2xl bg-yellow-500/10 border border-yellow-500/40">
          <div className="flex items-center gap-3 mb-4 text-yellow-500">
            <ShieldAlert className="w-5 h-5" />
            <h4 className="text-xs font-black uppercase tracking-widest">New Secret Key Generated</h4>
          </div>
          <p className="text-zinc-400 text-xs uppercase font-bold mb-4">
            Copy this key now. It will never be shown again.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 bg-black p-4 rounded-xl border border-yellow-500/20 font-mono text-yellow-500 text-sm break-all">
              {newKey}
            </code>
            <button onClick={() => copyToClipboard(newKey, 'new')} className="p-4 rounded-xl bg-yellow-500 text-black hover:bg-yellow-400 transition-colors">
              {copying === 'new' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="mt-4 text-xs font-black uppercase text-zinc-500 hover:text-white transition-colors">
            I have saved this key ✓
          </button>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-zinc-700" /></div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-zinc-900/20 border border-zinc-900">
            <Key className="w-8 h-8 text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-600 text-xs font-black uppercase tracking-widest">No active API keys</p>
          </div>
        ) : (
          keys.map((key) => (
            <div key={key.id} className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 flex justify-between items-center group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-tight text-white">{key.name || 'API Key'}</h4>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-xs font-mono text-zinc-600">Prefix: <span className="text-zinc-400">{key.key_prefix}...</span></p>
                    <p className="text-xs font-bold text-zinc-700 uppercase">Created: {new Date(key.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
              <button onClick={() => revokeKey(key.id)} className="p-3 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-zinc-600 hover:text-red-500 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <section className="pt-8 mt-8 border-t border-zinc-900">
        <button onClick={() => setShowQuickStart(!showQuickStart)} className="flex items-center justify-between w-full group">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-zinc-500 group-hover:text-yellow-500 transition-colors" />
            <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400 group-hover:text-white transition-colors">Developer Quick Start</h4>
          </div>
          <ChevronRight className={`w-4 h-4 text-zinc-700 transition-transform ${showQuickStart ? 'rotate-90' : ''}`} />
        </button>

        {showQuickStart && (
          <div className="mt-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {(['curl', 'node'] as const).map((lang) => (
                <div key={lang} className="space-y-3">
                  <h5 className="text-xs font-black text-zinc-600 uppercase tracking-widest">{lang === 'curl' ? 'cURL' : 'Node.js'}</h5>
                  <div className="relative bg-black rounded-xl p-5 font-mono text-xs leading-relaxed border border-zinc-900 text-zinc-400 group">
                    <pre className="whitespace-pre-wrap">{snippets[lang]}</pre>
                    <button onClick={() => copyToClipboard(snippets[lang], lang)} className="absolute right-3 top-3 p-2 bg-zinc-900 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      {copying === lang ? <Check className="w-3 h-3 text-yellow-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-5 rounded-2xl bg-yellow-500/5 border border-yellow-500/10 flex items-center justify-between">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Full protocol reference →</p>
              <a href="/docs" className="text-xs font-black text-yellow-500 hover:underline uppercase tracking-widest">View Docs</a>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
