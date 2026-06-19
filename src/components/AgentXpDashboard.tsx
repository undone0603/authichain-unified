'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Zap,
  TrendingUp,
  Award,
  CheckCircle2,
  Flame,
  Crown,
  Target,
  Loader2,
} from 'lucide-react';

interface AgentStats {
  agentId: string;
  agentName: string;
  level: number;
  xp: number;
  totalTasksCompleted: number;
  successRate: number;
  dealsClosedCount: number;
  revenueGeneratedUsd: number;
}

export default function AgentXpDashboard() {
  const [season, setSeason] = useState(1);

  const leaderboardQuery = trpc.agentXp.leaderboard.useQuery({
    limit: 10,
    season,
  });

  const myStatsQuery = trpc.agentXp.myStats.useQuery({
    season,
  });

  const leaderboard = leaderboardQuery.data?.leaderboard ?? [];
  const myStats = myStatsQuery.data?.agent;

  const nextLevelXp = (myStats?.level ?? 0) * 1000;
  const successRate = typeof myStats?.successRate === 'string'
    ? parseFloat(myStats.successRate)
    : (myStats?.successRate ?? 0);
  const xpProgress = myStats ? (myStats.xp % 1000) / 1000 : 0;

  return (
    <div className="w-full space-y-8">
      {/* Agent Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* My Stats Card */}
        <div className="protocol-card p-8 bg-gradient-to-br from-emerald-900/20 to-green-900/20 border-emerald-500/30">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <Crown className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">My Agent Stats</p>
              <p className="text-sm font-bold text-white">{myStats?.agentName ?? 'Autonomous AgentZ'}</p>
            </div>
          </div>

          {myStats ? (
            <div className="space-y-6">
              {/* Level and XP */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-black text-white">Level {myStats.level}</span>
                  <span className="text-xs font-bold text-zinc-400">{myStats.xp.toLocaleString()} XP</span>
                </div>
                <div className="h-3 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-green-400 transition-all"
                    style={{ width: `${xpProgress * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-2">
                  {Math.floor(myStats.xp % 1000)} / 1000 XP to next level
                </p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/40 p-3 rounded-lg">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight mb-1">Tasks Completed</p>
                  <p className="text-lg font-black text-emerald-400">{myStats.totalTasksCompleted}</p>
                </div>
                <div className="bg-black/40 p-3 rounded-lg">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight mb-1">Success Rate</p>
                  <p className="text-lg font-black text-green-400">{successRate.toFixed(0)}%</p>
                </div>
                <div className="bg-black/40 p-3 rounded-lg">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight mb-1">Deals Closed</p>
                  <p className="text-lg font-black text-cyan-400">{myStats.dealsClosedCount}</p>
                </div>
                <div className="bg-black/40 p-3 rounded-lg">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight mb-1">Revenue Generated</p>
                  <p className="text-lg font-black text-gold">${(
                    (typeof myStats.revenueGeneratedUsd === 'string'
                      ? parseFloat(myStats.revenueGeneratedUsd)
                      : myStats.revenueGeneratedUsd) / 1000
                  ).toFixed(0)}K</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
            </div>
          )}
        </div>

        {/* Season Info */}
        <div className="protocol-card p-8 bg-gradient-to-br from-gold/10 to-gold/5 border-gold/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-gold/10 border border-gold/30">
              <Award className="w-6 h-6 text-gold" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gold uppercase tracking-widest">Reputation System</p>
              <p className="text-sm font-bold text-white">Agent XP Leaderboard</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-tight mb-2">Current Season</p>
              <p className="text-3xl font-black text-white">{season}</p>
            </div>

            <div className="p-4 rounded-lg bg-gold/5 border border-gold/20">
              <p className="text-xs font-bold text-gold uppercase tracking-tight mb-2">How Agent XP Works</p>
              <ul className="space-y-2 text-[10px] text-zinc-300">
                <li className="flex gap-2">
                  <span className="text-gold">•</span>
                  <span>Complete tasks to earn XP and advance levels</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gold">•</span>
                  <span>Higher success rates unlock better opportunities</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gold">•</span>
                  <span>Closed deals and revenue contribute to ranking</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gold">•</span>
                  <span>Seasons reset quarterly with exclusive rewards</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="protocol-card p-8 bg-gradient-to-br from-zinc-900/50 to-zinc-950/50 border-zinc-800">
        <div className="flex items-center gap-3 mb-8">
          <TrendingUp className="w-5 h-5 text-gold" />
          <h2 className="text-sm font-black uppercase tracking-widest">Agent Leaderboard</h2>
          <div className="ml-auto flex gap-2">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-800/50 px-3 py-1 rounded-full">
              Season {season}
            </span>
          </div>
        </div>

        {leaderboardQuery.isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-500 text-sm">No agents on leaderboard yet. Complete tasks to earn XP!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((agent, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border transition-all ${
                  agent.agentId === 'autonomous-agent'
                    ? 'bg-gold/5 border-gold/30 ring-2 ring-gold/20'
                    : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Rank and Name */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center border border-zinc-700">
                      <span className="text-lg font-black text-gold">#{idx + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-white truncate">{agent.agentName}</h3>
                      <div className="flex gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-tight bg-zinc-900/50 px-2 py-0.5 rounded">
                          <Zap className="w-3 h-3" />
                          Level {agent.level}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-tight bg-zinc-900/50 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" />
                          {typeof agent.successRate === 'string' ? parseFloat(agent.successRate).toFixed(0) : agent.successRate.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex-shrink-0 grid grid-cols-2 gap-4 text-right">
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight mb-1">XP</p>
                      <p className="text-lg font-black text-gold">{(agent.xp / 1000).toFixed(1)}K</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight mb-1">Deals</p>
                      <p className="text-lg font-black text-emerald-400">{agent.dealsClosedCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
