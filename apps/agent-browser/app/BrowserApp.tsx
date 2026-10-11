'use client';
import { useState, useRef, useEffect } from 'react';

export default function AgentBrowser() {
    const [prompt, setPrompt] = useState('');
    const [chat, setChat] = useState<{role: string, text: string}[]>([
        { role: 'System', text: 'ZEE Command Center Online. MCP Memory Graph connected.' }
    ]);
    const [loading, setLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to the latest message
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chat]);

    const sendToSwarm = async () => {
        if (!prompt.trim()) return;
        const userText = prompt;
        setChat(prev => [...prev, { role: 'User', text: userText }]);
        setPrompt('');
        setLoading(true);

        try {
            const res = await fetch('/api/swarm', {
                method: 'POST',
                body: JSON.stringify({ prompt: userText }),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            setChat(prev => [...prev, { role: 'AgentZ', text: data.response || data.error }]);
        } catch (err) {
            setChat(prev => [...prev, { role: 'System', text: 'Error connecting to Swarm API.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-neutral-950 text-neutral-100 font-sans">
            {/* Swarm Status Sidebar */}
            <aside className="w-64 border-r border-neutral-800 bg-neutral-900/50 p-6 flex flex-col hidden md:flex">
                <h2 className="text-sm uppercase tracking-widest text-neutral-500 font-bold mb-6">Swarm Telemetry</h2>
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                        <span className="text-sm font-medium text-neutral-300">MCP Memory Graph</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)] delay-75"></div>
                        <span className="text-sm font-medium text-neutral-300">Agent Claude (Web3)</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.6)] delay-150"></div>
                        <span className="text-sm font-medium text-neutral-300">Agent Drizzle (DB)</span>
                    </div>
                </div>
            </aside>

            {/* Main Command Center Area */}
            <main className="flex-1 flex flex-col h-full relative">
                <header className="p-4 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-sm shadow-md">
                    <h1 className="text-xl font-bold tracking-wide">Agent Browser</h1>
                </header>
                
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
                    {chat.map((msg, i) => (
                        <div key={i} className={`p-5 rounded-2xl max-w-3xl ${msg.role === 'User' ? 'bg-blue-900/20 ml-auto border border-blue-800/50 rounded-tr-sm' : msg.role === 'System' ? 'bg-transparent mx-auto text-center text-neutral-500 text-xs tracking-widest uppercase font-bold' : 'bg-neutral-800/40 border border-neutral-700/50 rounded-tl-sm'}`}>
                            {msg.role !== 'System' && <span className="font-bold text-[10px] uppercase tracking-wider text-neutral-500 mb-2 block">{msg.role}</span>}
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        </div>
                    ))}
                    
                    {/* Active Loading Indicator */}
                    {loading && (
                        <div className="p-5 rounded-2xl max-w-3xl bg-neutral-800/40 border border-neutral-700/50 rounded-tl-sm">
                            <span className="font-bold text-[10px] uppercase tracking-wider text-neutral-500 mb-2 block">AgentZ</span>
                            <div className="text-neutral-400 text-sm flex gap-2 items-center">
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                                </div>
                                <span className="ml-2 animate-pulse">Querying the Swarm...</span>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-neutral-900/80 backdrop-blur-sm border-t border-neutral-800">
                    <div className="flex max-w-4xl mx-auto gap-3">
                        <input 
                            value={prompt} 
                            onChange={e => setPrompt(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendToSwarm()}
                            placeholder="Instruct the swarm to write code, query memory, or run tests..."
                            className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
                        />
                        <button 
                            onClick={sendToSwarm}
                            disabled={loading || !prompt.trim()}
                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-blue-500/20"
                        >
                            Execute
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
