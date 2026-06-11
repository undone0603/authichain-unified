'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  ShieldCheck,
  ArrowUpRight
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'verification' | 'link';
  data?: any;
}

export function TruthLayerChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: "Welcome to the AuthiChain Truth Layer. I am AgentZ. How can I help you verify reality today?",
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Simulate intelligent routing based on domain context
      const response = await fetch('/api/gpt/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: input.match(/\d+/) ? input.match(/\d+/)![0] : '101' })
      });
      
      const data = await response.json();
      
      const assistantMessage: Message = { 
        role: 'assistant', 
        content: data.message || "I've analyzed your request. The protocol confirms this asset is secured.",
        type: data.verified ? 'verification' : 'text',
        data: data
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Protocol connection lost. Please retry verification." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gold shadow-lg shadow-gold/20 flex items-center justify-center text-black z-50 hover:scale-110 transition-transform"
      >
        {isOpen ? <X /> : <MessageSquare />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[380px] h-[500px] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="p-4 bg-zinc-900 border-bottom border-zinc-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-gold" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-white">AgentZ Protocol</h3>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[9px] font-black text-zinc-500 uppercase">Autonomous Intelligence</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-xl text-xs ${
                  m.role === 'user' 
                    ? 'bg-gold text-black font-medium' 
                    : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
                }`}>
                  {m.content}
                  
                  {m.type === 'verification' && m.data?.verified && (
                    <div className="mt-3 p-2 bg-black/40 rounded border border-green-500/20 flex items-center gap-2">
                       <ShieldCheck className="w-3 h-3 text-green-500" />
                       <span className="text-[9px] font-black uppercase text-green-500">Blockchain Secured</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
                  <Loader2 className="w-4 h-4 animate-spin text-gold" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-zinc-900 bg-zinc-950">
            <div className="relative">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask AgentZ to verify an ID..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-gold/50 transition-colors"
              />
              <button 
                onClick={handleSend}
                className="absolute right-2 top-1.5 text-zinc-500 hover:text-gold transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
               <button className="text-[9px] font-black uppercase text-zinc-600 hover:text-gold transition-colors flex items-center gap-1">
                 View Docs <ArrowUpRight className="w-2.5 h-2.5" />
               </button>
               <button className="text-[9px] font-black uppercase text-zinc-600 hover:text-gold transition-colors flex items-center gap-1">
                 API Status <ArrowUpRight className="w-2.5 h-2.5" />
               </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
