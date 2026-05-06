'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { 
  Webhook, 
  Plus, 
  Trash2, 
  Loader2,
  Globe,
  Activity,
  Shield
} from 'lucide-react';

interface WebhookData {
  id: string;
  target_url: string;
  secret: string;
  event_types: string[];
}

export function WebhookManager({ userId }: { userId: string }) {
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');

  useEffect(() => {
    fetchWebhooks();
  }, []);

  async function fetchWebhooks() {
    setLoading(true);
    try {
      const res = await fetch('/api/webhooks');
      const data = await res.json();
      setWebhooks(data || []);
    } catch (_err) {
      console.error('Failed to fetch webhooks');
    } finally {
      setLoading(false);
    }
  }

  async function addWebhook() {
    if (!newUrl) return;
    setAdding(true);
    
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_url: newUrl,
          event_types: ['qron_scanned', 'security_anomaly']
        }),
      });

      if (res.ok) {
        setNewUrl('');
        fetchWebhooks();
      }
    } catch (_err) {
      console.error('Failed to add webhook');
    } finally {
      setAdding(false);
    }
  }

  async function deleteWebhook(id: string) {
    try {
      const res = await fetch(`/api/webhooks?id=${id}`, {
        method: 'DELETE'
      });
      if (res.ok) fetchWebhooks();
    } catch (_err) {
      console.error('Failed to delete webhook');
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-black uppercase tracking-tight">Event Webhooks</h3>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1">
            Receive real-time protocol event notifications
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input 
                type="url" 
                placeholder="https://your-api.com/webhooks" 
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-900 rounded-xl pl-12 pr-4 py-3 text-sm focus:border-gold outline-none transition-colors"
            />
        </div>
        <button
          onClick={addWebhook}
          disabled={adding || !newUrl}
          className="btn-gold px-8 py-3 rounded-xl flex items-center gap-2 font-black uppercase tracking-widest text-[10px] shadow-gold disabled:opacity-50"
        >
          {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Add Endpoint
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-800" />
          </div>
        ) : webhooks.length === 0 ? (
          <div className="protocol-card p-12 text-center bg-zinc-900/20 border-zinc-900">
            <Webhook className="w-8 h-8 text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">
              No webhooks configured
            </p>
          </div>
        ) : (
          webhooks.map((wh) => (
            <div key={wh.id} className="protocol-card p-6 flex justify-between items-center group bg-zinc-950/50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white truncate max-w-md">
                    {wh.target_url}
                  </h4>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-[10px] font-mono text-zinc-600">
                      Secret: <span className="text-zinc-400">••••••••{wh.secret.slice(-4)}</span>
                    </p>
                    <div className="flex gap-2">
                        {wh.event_types.map((t: string) => (
                            <span key={t} className="text-[8px] font-black text-gold/60 border border-gold/10 px-1 rounded uppercase">
                                {t.replace('_', ' ')}
                            </span>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => deleteWebhook(wh.id)}
                  className="p-3 rounded-lg hover:bg-red-500/10 text-zinc-700 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="protocol-card p-6 bg-purple-500/[0.03] border-purple-500/10 flex items-start gap-4">
          <Shield className="w-5 h-5 text-purple-400 mt-1" />
          <div>
              <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Webhook Security</h4>
              <p className="text-zinc-500 text-[10px] uppercase font-bold leading-relaxed tracking-tight">
                  All webhook requests include an <code>X-AuthiChain-Signature</code> header. 
                  Always verify this signature using your endpoint secret to ensure the request originated from the protocol.
              </p>
          </div>
      </div>
    </div>
  );
}
