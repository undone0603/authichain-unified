'use client';
import { useState, useRef, useEffect } from 'react';

type ChatMsg = {
  role: string;
  text: string;
  href?: string | null;
  hrefLabel?: string;
};

async function postAction(body: unknown): Promise<ChatMsg> {
  const res = await fetch('/api/swarm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const href = data.checkout_url || data.verify_url || null;
  return {
    role: 'Agent Browser',
    text: data.reply || data.error || 'No reply.',
    href,
    hrefLabel: data.checkout_url ? 'Open checkout' : data.verify_url ? 'Open verifier' : undefined,
  };
}

export default function AgentBrowser() {
  const [prompt, setPrompt] = useState('');
  const [recordId, setRecordId] = useState('');
  const [chat, setChat] = useState<ChatMsg[]>([
    {
      role: 'System',
      text: 'No agent credential in this session. Public actions only: catalogue, checkout link, or the open verifier. Commands and file writes are refused.',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const run = async (body: unknown, userText: string) => {
    setChat((prev) => [...prev, { role: 'User', text: userText }]);
    setLoading(true);
    try {
      const message = await postAction(body);
      setChat((prev) => [...prev, message]);
    } catch {
      setChat((prev) => [
        ...prev,
        { role: 'System', text: 'The capability endpoint did not answer.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 font-sans">
      <aside className="w-72 border-r border-neutral-800 bg-neutral-900/50 p-6 flex-col hidden md:flex">
        <h2 className="text-sm uppercase tracking-widest text-neutral-500 font-bold mb-6">
          Session
        </h2>
        <ul className="space-y-3 text-sm text-neutral-300">
          <li>Agent credential: none</li>
          <li>Public catalogue: available</li>
          <li>Verifier: link only, no local verdict</li>
          <li>Command execution: refused</li>
        </ul>
        <div className="mt-8 space-y-2">
          <button
            type="button"
            className="w-full rounded-lg border border-neutral-700 px-3 py-2 text-left text-sm hover:border-blue-500"
            onClick={() => run({ action: 'offers' }, 'Show public offers')}
            disabled={loading}
          >
            Public offers
          </button>
          <button
            type="button"
            className="w-full rounded-lg border border-neutral-700 px-3 py-2 text-left text-sm hover:border-blue-500"
            onClick={() =>
              run(
                { action: 'checkout', plan: 'dpp_readiness' },
                'Open EU DPP workspace checkout'
              )
            }
            disabled={loading}
          >
            DPP workspace checkout
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full">
        <header className="p-4 border-b border-neutral-800">
          <h1 className="text-xl font-bold">Agent Browser</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Catalogue, checkout, and the open verifier. This page does not run a swarm.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4">
          {chat.map((msg, i) => (
            <div
              key={i}
              className={`p-4 rounded-2xl max-w-3xl ${
                msg.role === 'User'
                  ? 'bg-blue-900/20 ml-auto border border-blue-800/50'
                  : 'bg-neutral-800/40 border border-neutral-700/50'
              }`}
            >
              <span className="font-bold text-[10px] uppercase tracking-wider text-neutral-500 mb-2 block">
                {msg.role}
              </span>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              {msg.href && msg.hrefLabel && (
                <a
                  className="mt-3 inline-block text-sm text-blue-400 underline"
                  href={msg.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {msg.hrefLabel}
                </a>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form
          className="p-4 border-t border-neutral-800 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const text = prompt.trim();
            if (!text || loading) return;
            setPrompt('');
            void run({ prompt: text }, text);
          }}
        >
          <div className="flex max-w-4xl mx-auto gap-3">
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="offers, checkout dpp_readiness, or verify polygon-anchor-1"
              className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 text-sm"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="bg-blue-600 disabled:bg-neutral-800 text-white px-5 py-3 rounded-xl text-sm font-bold"
            >
              Send
            </button>
          </div>
          <div className="flex max-w-4xl mx-auto gap-3">
            <input
              value={recordId}
              onChange={(event) => setRecordId(event.target.value)}
              placeholder="Record id for the open verifier"
              className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 text-sm"
            />
            <button
              type="button"
              disabled={loading || !recordId.trim()}
              className="border border-neutral-600 text-white px-5 py-3 rounded-xl text-sm"
              onClick={() => {
                const id = recordId.trim();
                if (!id || loading) return;
                setRecordId('');
                void run({ action: 'verify', id }, `Verify ${id}`);
              }}
            >
              Verify link
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
