'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Terminal, Send, Shield, Zap, Loader2, CheckCircle2 } from 'lucide-react';

export function AgentZCommander() {
  const [directive, setDirective] = useState('');

  const command = (trpc as any).pipeline.commander.useMutation({
    onSuccess: (data: any) => {
      toast.success("Directive Acknowledged", {
        description: data.actionTaken
      });
      setDirective('');
    },
    onError: (err: any) => toast.error("Command failed", { description: err.message })
  });

  const handleSendCommand = () => {
    if (directive.length < 5) {
      toast.error("Directive too short", { description: "Minimum 5 characters required." });
      return;
    }
    command.mutate({ text: directive });
  };

  return (
    <Card className="bg-zinc-950 border-zinc-800 overflow-hidden relative shadow-2xl">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2" />
      
      <CardHeader className="border-b border-zinc-900 pb-6 bg-zinc-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
               <Shield className="w-5 h-5 text-primary" />
             </div>
             <div>
               <CardTitle className="text-xl font-black uppercase tracking-tighter italic">AgentZ <span className="gold-text">Commander</span></CardTitle>
               <CardDescription className="text-zinc-600 uppercase text-[9px] font-bold tracking-[0.2em] mt-1">
                 Strategic Intelligence Overlay v1.0
               </CardDescription>
             </div>
          </div>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
             <span className="text-[9px] font-black text-zinc-500 uppercase">Governor Authorized</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-8 relative z-10">
        <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800 mb-8 font-mono">
           <div className="flex gap-4 text-xs text-zinc-500 mb-2">
              <span className="text-zinc-700">#</span>
              <span>Available Directives: "Scale cannabis outreach", "Submit new grants", "Hunt threats on eBay"...</span>
           </div>
           <div className="flex gap-4 items-center">
              <Terminal className="w-4 h-4 text-primary shrink-0" />
              <input 
                value={directive}
                onChange={e => setDirective(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendCommand()}
                placeholder="Issue strategic protocol directive..."
                className="flex-1 bg-transparent border-none outline-none text-white text-sm"
              />
              <Button 
                size="sm" 
                onClick={handleSendCommand} 
                disabled={command.isLoading}
                className="btn-gold h-10 px-6 gap-2 font-black uppercase tracking-widest text-[10px]"
              >
                {command.isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Execute
              </Button>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {[
             { label: 'Autonomous Weight', val: '92%', color: 'text-green-500' },
             { label: 'Strategic Clarity', val: 'OPTIMAL', color: 'text-blue-500' },
             { label: 'Decision Latency', val: '14ms', color: 'text-gold' }
           ].map((stat) => (
             <div key={stat.label} className="p-4 bg-zinc-900/30 rounded-lg border border-zinc-900/50">
                <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1">{stat.label}</p>
                <p className={`text-sm font-black ${stat.color}`}>{stat.val}</p>
             </div>
           ))}
        </div>
      </CardContent>
    </Card>
  );
}
