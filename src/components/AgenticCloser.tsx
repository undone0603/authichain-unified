'use client';
import { Send, Terminal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function AgenticCloser() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'system-init',
    role: 'assistant',
    content: 'System Initialized. I am AgentZ, Integration Engineer for AuthiChain. How can I assist you with the Zapbox integration or our $199 Single-Project Pilot today?',
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })) }),
      });

      const assistantId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          ));
        }
      }
    } catch {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[500px] bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <Terminal className="w-5 h-5 text-emerald-400" />
        <h3 className="font-bold text-sm text-zinc-100 tracking-wider">AGENT-Z // SECURE CHANNEL</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm font-mono">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-lg ${m.role === 'user' ? 'bg-emerald-600/20 text-emerald-100 border border-emerald-500/30' : 'bg-zinc-900 text-zinc-300 border border-zinc-800'}`}>
              <span className="block mb-1 text-[10px] uppercase opacity-50">{m.role === 'user' ? 'Guest' : 'AgentZ'}</span>
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && <div className="text-emerald-500/50 text-xs animate-pulse">AgentZ is typing...</div>}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-800 bg-zinc-900/30">
        <div className="relative flex items-center">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about pricing, specs, or integration..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-4 pr-12 py-3 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={isLoading || !input}
            className="absolute right-2 p-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white rounded-md transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
