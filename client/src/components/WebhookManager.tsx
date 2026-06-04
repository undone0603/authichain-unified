import { useState, useEffect } from 'react';
import { Webhook, Plus, Trash2, Loader2, Globe, Activity, Shield } from 'lucide-react';

interface WebhookData {
  id: string;
  target_url: string;
  secret: string;
  event_types: string[];
}

export function WebhookManager({ userId: _userId }: { userId: string }) {
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');

  async function fetchWebhooks() {
    setLoading(true);
    try {
      const res = await fetch('/api/webhooks');
      const data = await res.json();
      setWebhooks(data || []);
    } catch { /* silent */ }
    setLoading(false);
  }

  useEffect(() => { fetchWebhooks(); }, []);

  async function addWebhook() {
    if (!newUrl) return;
    setAdding(true);
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_url: newUrl, event_types: ['product_scanned', 'certificate_minted', 'security_anomaly'] }),
      });
      if (res.ok) { setNewUrl(''); fetchWebhooks(); }
    } catch { /* silent */ }
    setAdding(false);
  }

  async function deleteWebhook(id: string) {
    await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
    fetchWebhooks();
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-black uppercase tracking-tight text-white">Event Webhooks</h3>
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">
          Receive real-time notifications for product scans, NFT mints, and anomalies
        </p>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            type="url"
            placeholder="https://your-api.com/webhooks"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addWebhook()}
            className="w-full bg-zinc-950 border border-zinc-900 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:border-yellow-500/50 outline-none transition-colors"
          />
        </div>
        <button
          onClick={addWebhook}
          disabled={adding || !newUrl}
          className="px-8 py-3 rounded-xl flex items-center gap-2 font-black uppercase tracking-widest text-xs bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-50 transition-colors"
        >
          {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Add
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-zinc-800" /></div>
        ) : webhooks.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-zinc-900/20 border border-zinc-900">
            <Webhook className="w-8 h-8 text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-600 text-xs font-black uppercase tracking-widest">No webhooks configured</p>
          </div>
        ) : (
          webhooks.map((wh) => (
            <div key={wh.id} className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 flex justify-between items-center group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white truncate max-w-sm">{wh.target_url}</h4>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs font-mono text-zinc-600">Secret: <span className="text-zinc-400">••••{wh.secret.slice(-4)}</span></p>
                    <div className="flex gap-1.5">
                      {wh.event_types.map((t) => (
                        <span key={t} className="text-xs font-bold text-yellow-500/60 border border-yellow-500/10 px-1.5 py-0.5 rounded uppercase">{t.replace('_', ' ')}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => deleteWebhook(wh.id)} className="p-3 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-zinc-700 hover:text-red-500 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="p-5 rounded-2xl bg-purple-500/5 border border-purple-500/10 flex items-start gap-4">
        <Shield className="w-5 h-5 text-purple-400 mt-0.5" />
        <div>
          <h4 className="text-xs font-black text-purple-400 uppercase tracking-widest mb-1">Webhook Security</h4>
          <p className="text-zinc-500 text-xs uppercase font-bold leading-relaxed">
            All requests include an <code className="text-purple-300">X-AuthiChain-Signature</code> header. Verify it using your endpoint secret to confirm the request originated from the protocol.
          </p>
        </div>
      </div>
    </div>
  );
}
