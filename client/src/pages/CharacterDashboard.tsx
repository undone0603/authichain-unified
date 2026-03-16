import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Shield, Zap, Star, Trophy, TrendingUp, Coins, Sparkles, ArrowRight } from "lucide-react";

function getLevelFromXP(xp: number) {
  if (xp >= 10000) return { level: 5, title: "Legendary", next: Infinity, color: "text-amber-400" };
  if (xp >= 5000) return { level: 4, title: "Master", next: 10000, color: "text-yellow-400" };
  if (xp >= 2000) return { level: 3, title: "Expert", next: 5000, color: "text-blue-400" };
  if (xp >= 500) return { level: 2, title: "Adept", next: 2000, color: "text-emerald-400" };
  return { level: 1, title: "Novice", next: 500, color: "text-gray-400" };
}

export default function CharacterDashboard() {
  const agent = trpc.character.myAgent.useQuery();
  const assets = trpc.character.myAssets.useQuery();
  const rewards = trpc.character.agentRewards.useQuery(
    { agentId: agent.data?.id ?? 0 },
    { enabled: !!agent.data?.id }
  );

  if (agent.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  // No agent yet — redirect to create
  if (!agent.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-yellow-600 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold">No Agent Deployed</h2>
          <p className="text-gray-400">Create your AuthiCharacter and deploy a protocol agent to start earning QRON rewards.</p>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <a href="/character/create">Create Your Agent <ArrowRight className="w-4 h-4 ml-1" /></a>
          </Button>
        </div>
      </div>
    );
  }

  const agentData = agent.data;
  const xp = agentData.xp || 100;
  const levelInfo = getLevelFromXP(xp);
  const xpProgress = levelInfo.next === Infinity ? 100 : ((xp - (levelInfo.next === 500 ? 0 : levelInfo.next === 2000 ? 500 : levelInfo.next === 5000 ? 2000 : 5000)) / (levelInfo.next - (levelInfo.next === 500 ? 0 : levelInfo.next === 2000 ? 500 : levelInfo.next === 5000 ? 2000 : 5000))) * 100;
  const selectedAsset = assets.data?.find((a: any) => a.asset.id === agentData.characterAssetId);
  const totalQRON = rewards.data?.reduce((sum: number, r: any) => sum + parseFloat(r.qronAmount || "0"), 0) || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="container max-w-6xl py-8">
        {/* Agent Hero Card */}
        <Card className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-gray-700 mb-8 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col md:flex-row">
              {/* Character Image */}
              <div className="w-full md:w-64 h-64 bg-gray-800 flex-shrink-0">
                {selectedAsset?.asset?.imageUrl ? (
                  <img src={selectedAsset.asset.imageUrl} alt="Agent" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Shield className="w-16 h-16 text-gray-600" />
                  </div>
                )}
              </div>
              {/* Agent Info */}
              <div className="flex-1 p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{agentData.name}</h1>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 capitalize">
                    {agentData.agentType}
                  </Badge>
                  <Badge className={`${levelInfo.color} bg-gray-800 border-gray-700`}>
                    Lv.{levelInfo.level} {levelInfo.title}
                  </Badge>
                </div>
                <p className="text-gray-400 text-sm">
                  Status: <span className={`font-semibold ${agentData.status === "active" ? "text-emerald-400" : "text-amber-400"}`}>
                    {agentData.status?.toUpperCase() || "ACTIVE"}
                  </span>
                </p>

                {/* XP Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>XP: {xp.toLocaleString()}</span>
                    {levelInfo.next !== Infinity && <span>Next: {levelInfo.next.toLocaleString()}</span>}
                  </div>
                  <Progress value={Math.max(5, Math.min(100, xpProgress))} className="h-2 bg-gray-700" />
                </div>

                {/* Quick Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                      <Shield className="w-3 h-3" /> Reputation
                    </div>
                    <div className="text-lg font-bold">{agentData.reputationScore || 100}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                      <TrendingUp className="w-3 h-3" /> Verifications
                    </div>
                    <div className="text-lg font-bold">{agentData.totalVerifications || 0}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                      <Trophy className="w-3 h-3" /> Consensus Wins
                    </div>
                    <div className="text-lg font-bold">{agentData.consensusParticipations || 0}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                      <Coins className="w-3 h-3" /> QRON Earned
                    </div>
                    <div className="text-lg font-bold text-amber-400">{totalQRON.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Reward History */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" /> QRON Reward History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!rewards.data || rewards.data.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Coins className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No rewards yet. Start verifying products to earn QRON.</p>
                    <Button asChild variant="outline" className="mt-3 border-gray-700 text-gray-300">
                      <a href="/authenticate">Verify a Product</a>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rewards.data.map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                        <div>
                          <span className="text-sm font-medium text-white capitalize">{r.rewardType?.replace(/_/g, " ")}</span>
                          <p className="text-xs text-gray-500">{r.description}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-amber-400 font-mono font-bold">+{parseFloat(r.qronAmount || "0").toFixed(2)}</span>
                          <p className="text-xs text-gray-500">+{r.xpAmount || 0} XP</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Agent Actions */}
          <div className="space-y-6">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-400" /> Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                  <a href="/authenticate">
                    <Shield className="w-4 h-4 mr-2" /> Verify Product
                  </a>
                </Button>
                <Button asChild variant="outline" className="w-full border-gray-700 text-gray-300">
                  <a href="/network">
                    <Trophy className="w-4 h-4 mr-2" /> View Leaderboard
                  </a>
                </Button>
                <Button asChild variant="outline" className="w-full border-gray-700 text-gray-300">
                  <a href="/character/create">
                    <Star className="w-4 h-4 mr-2" /> Generate New Character
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Character Gallery */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white text-sm">My Characters</CardTitle>
              </CardHeader>
              <CardContent>
                {!assets.data || assets.data.length === 0 ? (
                  <p className="text-sm text-gray-500">No characters generated yet.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {assets.data.slice(0, 6).map((a: any) => (
                      <div key={a.asset.id} className={`aspect-square rounded-lg overflow-hidden border-2 ${
                        a.asset.id === agentData.characterAssetId ? "border-blue-500" : "border-gray-700"
                      }`}>
                        <img src={a.asset.imageUrl} alt="Character" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
