'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal, Cpu, Zap, Activity, ShieldCheck, AlertCircle } from 'lucide-react';

interface MatrixLog {
  id: string;
  workflow: string;
  status: string;
  payload: any;
  at: string;
}

export default function MatrixActivityFeed() {
  const [logs, setLogs] = useState<MatrixLog[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch('/api/admin/ops');
        const data = await res.json();
        if (data.recent) {
          const formatted = data.recent.map((r: any, i: number) => ({
            id: `${r.at}-${i}`,
            workflow: r.workflow,
            status: r.status,
            at: r.at,
            payload: data.summary.find((s: any) => s.workflow === r.workflow)?.last_error || 'Execution complete'
          }));
          setLogs(formatted);
        }
      } catch (err) {
        console.error('Matrix feed failed', err);
      }
    }
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="protocol-card bg-black border-zinc-900 overflow-hidden flex flex-col h-[500px]">
      <div className="bg-zinc-900/50 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <Terminal className="w-3 h-3 text-emerald-500" />
           <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">AgentZ Live Stream</span>
        </div>
        <div className="flex gap-1.5">
           <div className="w-2 h-2 rounded-full bg-red-500/20" />
           <div className="w-2 h-2 rounded-full bg-yellow-500/20" />
           <div className="w-2 h-2 rounded-full bg-emerald-500/20" />
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-[10px] space-y-2 scrollbar-hide selection:bg-emerald-500 selection:text-black"
      >
        {logs.map((log) => (
          <div key={log.id} className="flex gap-4 group animate-in fade-in slide-in-from-left-2 duration-500">
            <span className="text-zinc-700 shrink-0">[{new Date(log.at).toLocaleTimeString([], { hour12: false })}]</span>
            <div className="flex-1 space-y-1">
               <div className="flex items-center gap-2">
                  <span className={`${log.status === 'success' ? 'text-emerald-500' : 'text-red-500'} font-black uppercase`}>
                    {log.status === 'success' ? '>>>' : '!!!'}
                  </span>
                  <span className="text-zinc-200 font-bold uppercase tracking-tighter">{log.workflow.replace(/_/g, ' ')}</span>
                  <span className="text-zinc-800">|</span>
                  <span className="text-zinc-500">{log.status}</span>
               </div>
               <p className="text-zinc-600 leading-relaxed truncate group-hover:text-zinc-400 transition-colors">
                  {typeof log.payload === 'string' ? log.payload : JSON.stringify(log.payload)}
               </p>
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="h-full flex items-center justify-center text-zinc-800 uppercase font-black tracking-[0.3em]">
             Awaiting Pulse...
          </div>
        )}
      </div>

      <div className="bg-emerald-500/5 px-4 py-2 border-t border-emerald-500/10 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] font-black text-emerald-500/60 uppercase tracking-widest">Truth Ledger Sync Active</span>
         </div>
         <span className="text-[8px] font-mono text-zinc-700">COORD: 45.4642, 9.1900</span>
      </div>
    </div>
  );
}
