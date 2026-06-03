'use client';
import { Send, MessageSquare, ShieldCheck, Cpu } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ProductConciergeProps {
  productName: string;
  brandName: string;
  productId: string;
  personaPrompt?: string;
}

export default function ProductConcierge({ productName, brandName, productId, personaPrompt }: ProductConciergeProps) {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'system-init',
    role: 'assistant',
    content: `Greetings. I am the ${productName} AI Concierge. My identity is cryptographically linked to this physical asset. How can I verify my origin or assist you with this ${brandName} artifact today?`,
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
      const res = await fetch('/api/chat/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          productId,
          personaPrompt
        }),
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
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: 'Neural link interrupted. Please retry scan.' }]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[450px] bg-zinc-950 border border-gold/20 rounded-2xl overflow-hidden shadow-2xl relative group">
      <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center border border-gold/30">
            <Cpu className="w-4 h-4 text-gold animate-pulse" />
          </div>
          <div>
            <h3 className="font-black text-[10px] text-white tracking-widest uppercase">AI Concierge</h3>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">Voice of Product // Edge Verified</p>
          </div>
        </div>
        <ShieldCheck className="w-5 h-5 text-emerald-500/50" />
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl ${
              m.role === 'user' 
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' 
                : 'bg-gold/10 text-zinc-200 border border-gold/20 backdrop-blur-sm'
            }`}>
              <span className="block mb-2 text-[9px] font-black uppercase tracking-widest opacity-40">
                {m.role === 'user' ? 'Consumer' : productName}
              </span>
              <p className="leading-relaxed font-medium">{m.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-gold/50 text-[10px] font-black uppercase tracking-widest animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: '300ms' }} />
            Thinking...
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-800 bg-black/50 backdrop-blur-md z-10">
        <div className="relative flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about origins, care, or rewards..."
              className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl pl-4 pr-10 py-3 text-xs text-zinc-100 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all placeholder:text-zinc-600 font-medium"
            />
            <MessageSquare className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-700" />
          </div>
          <button
            type="submit"
            disabled={isLoading || !input}
            className="p-3 bg-gold hover:bg-yellow-500 disabled:bg-zinc-800 text-black rounded-xl transition-all shadow-lg active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
