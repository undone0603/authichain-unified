'use client';

import { ShieldCheck, Trophy, Zap, Star, Award, ChevronUp } from 'lucide-react';

interface AgentXPProps {
  agent: {
    name: string;
    level: number;
    xp: number;
    reputationScore: number;
    totalVerifications: number;
    agentType: string;
  };
}

export default function AgentXPDisplay({ agent }: AgentXPProps) {
  // Leveling logic: Level 1 = 0 XP, Level 2 = 500 XP, Level 3 = 1500 XP, etc.
  const xpForNextLevel = agent.level * 1000;
  const progress = Math.min(100, (agent.xp / xpForNextLevel) * 100);

  const badges = [
    { id: 'genesis', label: 'Genesis Guardian', icon: Star, color: 'text-gold', earned: true },
    { id: 'verifier', label: 'Certified Verifier', icon: ShieldCheck, color: 'text-blue-400', earned: agent.totalVerifications >= 10 },
    { id: 'elite', label: 'Elite Auditor', icon: Award, color: 'text-purple-400', earned: agent.level >= 5 },
    { id: 'reputation', label: 'Trust Pillar', icon: Trophy, color: 'text-emerald-400', earned: agent.reputationScore >= 95 }
  ];

  return (
    <div className="protocol-card p-6 bg-zinc-950/50 border-zinc-900 group">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center relative overflow-hidden">
             <Zap className="w-6 h-6 text-gold" />
             <div className="absolute inset-0 bg-gradient-to-t from-gold/10 to-transparent" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-white">{agent.name}</h3>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">{agent.agentType} Agent &bull; Level {agent.level}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Reputation</p>
          <div className="flex items-center gap-1 justify-end">
             <span className="text-lg font-black text-white">{agent.reputationScore}</span>
             <ChevronUp className="w-4 h-4 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="space-y-2 mb-8">
        <div className="flex justify-between items-end">
           <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Protocol Experience (XP)</p>
           <p className="text-[9px] font-mono text-zinc-400">{agent.xp} / {xpForNextLevel}</p>
        </div>
        <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
           <div 
             className="h-full bg-gradient-to-r from-gold to-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)] transition-all duration-1000"
             style={{ width: `${progress}%` }}
           />
        </div>
      </div>

      {/* Badges */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Earned Proof Badges</h4>
        <div className="grid grid-cols-4 gap-3">
          {badges.map((b) => (
            <div 
              key={b.id} 
              className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                b.earned 
                  ? 'bg-white/5 border-white/10 hover:border-white/20' 
                  : 'bg-black border-zinc-900 grayscale opacity-20'
              }`}
            >
              <b.icon className={`w-5 h-5 mb-2 ${b.earned ? b.color : 'text-zinc-700'}`} />
              <span className="text-[7px] font-black text-center uppercase leading-tight tracking-tighter line-clamp-2">
                {b.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
