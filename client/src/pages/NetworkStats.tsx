import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Globe, Shield, Users, Coins, TrendingUp, Trophy, Zap, Activity, ArrowRight } from "lucide-react";

export default function NetworkStats() {
  const stats = trpc.character.networkStats.useQuery();
  const leaderboard = trpc.character.leaderboard.useQuery({ limit: 20 });

  if (stats.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  const s = stats.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="container max-w-6xl py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-4">
            <Globe className="w-4 h-4" />
            Live Protocol Metrics
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            AuthiChain Network
          </h1>
          <p className="text-gray-400 mt-2">Real-time protocol health, agent activity, and QRON economics</p>
        </div>

        {/* Top Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Active Agents", value: s?.totalAgents || 0, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
            { label: "Total Verifications", value: s?.totalVerifications || 0, icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "QRON Distributed", value: `${parseFloat(String(s?.totalQRONDistributed || "0")).toFixed(1)}`, icon: Coins, color: "text-amber-400", bg: "bg-amber-500/10" },
            { label: "Consensus Rounds", value: s?.totalConsensus || 0, icon: Activity, color: "text-purple-400", bg: "bg-purple-500/10" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-5">
                  <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div className="text-2xl font-bold text-white">{typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}</div>
                  <div className="text-xs text-gray-400 mt-1">{stat.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Agent Distribution + Network Health */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Agent Type Distribution */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" /> Agent Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {s?.agentsByType && s.agentsByType.length > 0 ? (
                <div className="space-y-3">
                  {s.agentsByType.map((t: any) => {
                    const total = s.totalAgents || 1;
                    const pct = ((t.count / total) * 100).toFixed(0);
                    const colors: Record<string, string> = {
                      guardian: "bg-blue-500",
                      archivist: "bg-purple-500",
                      sentinel: "bg-red-500",
                      scout: "bg-emerald-500",
                      arbiter: "bg-amber-500",
                    };
                    return (
                      <div key={t.type} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize text-gray-300">{t.type}</span>
                          <span className="text-gray-500">{t.count} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colors[t.type] || "bg-gray-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No agents deployed yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Network Health */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" /> Network Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                  <div className="text-xs text-gray-400">Avg Reputation</div>
                  <div className="text-xl font-bold text-emerald-400">100</div>
                </div>
                <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                  <div className="text-xs text-gray-400">Characters Generated</div>
                  <div className="text-xl font-bold text-blue-400">{s?.totalCheckpoints || 0}</div>
                </div>
                <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                  <div className="text-xs text-gray-400">Mint-Ready NFTs</div>
                  <div className="text-xl font-bold text-purple-400">0</div>
                </div>
                <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                  <div className="text-xs text-gray-400">Protocol Status</div>
                  <div className="text-xl font-bold text-emerald-400">Active</div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 text-emerald-400 text-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Network operational — all systems nominal
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Leaderboard */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" /> Agent Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!leaderboard.data || leaderboard.data.length === 0 ? (
              <div className="text-center py-10">
                <Trophy className="w-12 h-12 mx-auto text-gray-700 mb-3" />
                <p className="text-gray-500">No agents on the leaderboard yet.</p>
                <Button asChild className="mt-4 bg-blue-600 hover:bg-blue-700">
                  <a href="/character/create">Be the First <ArrowRight className="w-4 h-4 ml-1" /></a>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-800">
                      <th className="text-left py-3 px-2">Rank</th>
                      <th className="text-left py-3 px-2">Agent</th>
                      <th className="text-left py-3 px-2">Type</th>
                      <th className="text-right py-3 px-2">XP</th>
                      <th className="text-right py-3 px-2">Reputation</th>
                      <th className="text-right py-3 px-2">Verifications</th>
                      <th className="text-right py-3 px-2">QRON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.data.map((agent: any, i: number) => {
                      const rankColors = ["text-amber-400", "text-gray-300", "text-amber-700"];
                      const rankIcons = ["🥇", "🥈", "🥉"];
                      return (
                        <tr key={agent.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="py-3 px-2">
                            <span className={`font-bold ${rankColors[i] || "text-gray-500"}`}>
                              {i < 3 ? rankIcons[i] : `#${i + 1}`}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <span className="font-medium text-white">{agent.name}</span>
                          </td>
                          <td className="py-3 px-2">
                            <Badge variant="outline" className="capitalize text-xs border-gray-700 text-gray-400">
                              {agent.agentType}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className="font-mono text-blue-400">{(agent.xp || 0).toLocaleString()}</span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className={`font-mono ${(agent.reputationScore || 0) >= 80 ? "text-emerald-400" : "text-amber-400"}`}>
                              {agent.reputationScore || 0}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className="font-mono text-gray-300">{agent.totalVerifications || 0}</span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className="font-mono text-amber-400">{parseFloat(agent.totalQRONEarned || "0").toFixed(2)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-500/20">
            <CardContent className="p-8">
              <h3 className="text-xl font-bold text-white mb-2">Join the AuthiChain Protocol</h3>
              <p className="text-gray-400 mb-4">Create your AI agent, verify products, earn QRON rewards, and help build the world's most trusted authentication network.</p>
              <div className="flex gap-3 justify-center">
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <a href="/character/create">
                    <Zap className="w-4 h-4 mr-2" /> Create Agent
                  </a>
                </Button>
                <Button asChild variant="outline" className="border-gray-600 text-gray-300">
                  <a href="/pricing">View Plans</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
