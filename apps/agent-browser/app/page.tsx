'use client';
import { useState } from 'react';

export default function AgentBrowser() {
    const [prompt, setPrompt] = useState('');
    const [chat, setChat] = useState<{role: string, text: string}[]>([]);
    const [loading, setLoading] = useState(false);

    const sendToSwarm = async () => {
        if (!prompt) return;
        setChat(prev => [...prev, { role: 'User', text: prompt }]);
        setLoading(true);

        const res = await fetch('/api/swarm', {
            method: 'POST',
            body: JSON.stringify({ prompt }),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();

        setChat(prev => [...prev, { role: 'AgentZ', text: data.response || data.error }]);
        setPrompt('');
        setLoading(false);
    };

    return (
        <main className="flex flex-col h-screen bg-neutral-950 text-neutral-100 font-sans">
            <header className="p-4 border-b border-neutral-800 bg-neutral-900 shadow-md">
                <h1 className="text-xl font-bold tracking-wide">🌐 Agent Browser Command Center</h1>
                <p className="text-sm text-neutral-400">Zero-Latency Swarm Interface</p>
            </header>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {chat.map((msg, i) => (
                    <div key={i} className={`p-4 rounded-lg max-w-2xl ${msg.role === 'User' ? 'bg-blue-900/40 ml-auto border border-blue-800' : 'bg-neutral-800 border border-neutral-700'}`}>
                        <span className="font-bold text-xs uppercase tracking-wider text-neutral-400">{msg.role}</span>
                        <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                ))}
                {loading && <div className="text-neutral-500 animate-pulse text-sm">AgentZ is consulting the Swarm Graph...</div>}
            </div>

            <div className="p-4 bg-neutral-900 border-t border-neutral-800">
                <div className="flex max-w-4xl mx-auto gap-2">
                    <input 
                        value={prompt} 
                        onChange={e => setPrompt(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendToSwarm()}
                        placeholder="Ask the swarm to draft a contract, query the database, or deploy code..."
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <button 
                        onClick={sendToSwarm}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded font-medium text-sm transition-colors"
                    >
                        Execute
                    </button>
                </div>
            </div>
        </main>
    );
}
