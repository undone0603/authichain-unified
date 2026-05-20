import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles, Shield, BookOpen, Eye, Compass, Scale, Check, Star, Zap, ChevronRight, ShoppingBag, Map } from "lucide-react";

const ARCHETYPES = [
  { key: "guardian" as const, name: "Guardian", icon: Shield, color: "from-blue-500 to-blue-700", description: "Protects brand integrity and product authenticity", abilities: ["Verify", "Protect", "Alert"] },
  { key: "archivist" as const, name: "Archivist", icon: BookOpen, color: "from-yellow-500 to-yellow-600", description: "Records and preserves provenance data on-chain", abilities: ["Record", "Archive", "Query"] },
  { key: "sentinel" as const, name: "Sentinel", icon: Eye, color: "from-red-500 to-red-700", description: "Monitors supply chain integrity in real-time", abilities: ["Monitor", "Detect", "Respond"] },
  { key: "scout" as const, name: "Scout", icon: Compass, color: "from-emerald-500 to-emerald-700", description: "Discovers counterfeits and maps threat networks", abilities: ["Scan", "Discover", "Map"] },
  { key: "arbiter" as const, name: "Arbiter", icon: Scale, color: "from-amber-500 to-amber-700", description: "Resolves disputes and renders consensus verdicts", abilities: ["Judge", "Resolve", "Settle"] },
  { key: "merchant" as const, name: "Merchant", icon: ShoppingBag, color: "from-pink-500 to-pink-700", description: "Facilitates authentic commerce and value exchange", abilities: ["Trade", "Certify", "Price"] },
  { key: "explorer" as const, name: "Explorer", icon: Map, color: "from-cyan-500 to-cyan-700", description: "Charts new authentication frontiers and protocols", abilities: ["Discover", "Pioneer", "Integrate"] },
];

type Step = "archetype" | "context" | "generating" | "select" | "name" | "complete";

export default function CharacterCreate() {
  const [step, setStep] = useState<Step>("archetype");
  const [selectedArchetype, setSelectedArchetype] = useState<typeof ARCHETYPES[number] | null>(null);
  const [brand, setBrand] = useState("");
  const [object, setObject] = useState("");
  const [colorway, setColorway] = useState("");
  const [mood, setMood] = useState("");
  const [generationId, setGenerationId] = useState<number | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [agentName, setAgentName] = useState("");

  const generateMutation = trpc.character.generate.useMutation({
    onSuccess: (data: any) => {
      setGenerationId(data.generationId);
      setStep("generating");
      toast.success("Character generation started!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const generationStatus = trpc.character.generationStatus.useQuery(
    { generationId: generationId! },
    { enabled: !!generationId, refetchInterval: step === "generating" ? 3000 : false }
  );

  const selectMutation = trpc.character.select.useMutation({
    onSuccess: () => {
      setStep("name");
      toast.success("Character selected! Now name your agent.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const createAgentMutation = trpc.character.createAgent.useMutation({
    onSuccess: () => {
      setStep("complete");
      toast.success("Protocol agent created!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Auto-advance when generation completes
  useEffect(() => {
    if (generationStatus.data?.status === "completed" && step === "generating") {
      setStep("select");
    }
  }, [generationStatus.data?.status, step]);

  const handleGenerate = () => {
    if (!selectedArchetype) return;
    generateMutation.mutate({
      archetype: selectedArchetype.key,
      context: {
        brand: brand || undefined,
        object: object || undefined,
        colorway: colorway || undefined,
        mood: mood || undefined,
      },
    });
  };

  const handleSelect = () => {
    if (!selectedAssetId) return;
    selectMutation.mutate({ characterAssetId: selectedAssetId });
  };

  const handleCreateAgent = () => {
    if (!selectedAssetId || !agentName || !selectedArchetype) return;
    createAgentMutation.mutate({
      characterAssetId: selectedAssetId,
      agentName: agentName,
      agentType: selectedArchetype.key,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="container max-w-6xl py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm mb-4">
            <Sparkles className="w-4 h-4" />
            AuthiCharacter Protocol
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-yellow-500 to-emerald-400 bg-clip-text text-transparent">
            Create Your Protocol Agent
          </h1>
          <p className="text-gray-400 mt-2 max-w-xl mx-auto">
            Generate an AI-powered character, score its attributes, and deploy it as your verification agent on the AuthiChain network.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {["Archetype", "Context", "Generate", "Select", "Name", "Deploy"].map((label, i) => {
            const steps: Step[] = ["archetype", "context", "generating", "select", "name", "complete"];
            const isActive = steps.indexOf(step) >= i;
            const isCurrent = steps.indexOf(step) === i;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isActive ? "bg-blue-500 text-white" : "bg-gray-800 text-gray-500"
                } ${isCurrent ? "ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-950" : ""}`}>
                  {isActive && i < steps.indexOf(step) ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:inline ${isActive ? "text-blue-400" : "text-gray-600"}`}>{label}</span>
                {i < 5 && <ChevronRight className="w-4 h-4 text-gray-700" />}
              </div>
            );
          })}
        </div>

        {/* Step 1: Archetype Selection */}
        {step === "archetype" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-center">Choose Your Agent Archetype</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {ARCHETYPES.map((arch) => {
                const Icon = arch.icon;
                const isSelected = selectedArchetype?.key === arch.key;
                return (
                  <Card
                    key={arch.key}
                    className={`cursor-pointer transition-all hover:scale-[1.02] border-2 bg-gray-900/50 ${
                      isSelected ? "border-blue-500 shadow-lg shadow-blue-500/20" : "border-gray-800 hover:border-gray-700"
                    }`}
                    onClick={() => setSelectedArchetype(arch)}
                  >
                    <CardContent className="p-6">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${arch.color} flex items-center justify-center mb-4`}>
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">{arch.name}</h3>
                      <p className="text-xs text-gray-400 leading-relaxed mb-4">{arch.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {arch.abilities.map((a) => (
                          <Badge key={a} variant="secondary" className="text-[10px] py-0 bg-gray-800 text-gray-300 border-none">
                            {a}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="flex justify-center pt-4">
              <Button
                size="lg"
                disabled={!selectedArchetype}
                onClick={() => setStep("context")}
                className="bg-blue-600 hover:bg-blue-700 px-8"
              >
                Continue to Context <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Generation Context */}
        {step === "context" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Define Visual Context</CardTitle>
                <CardDescription>Tell the AI how your {selectedArchetype?.name} should look</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Brand Influence</Label>
                    <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g., Apple, Nike, Rolex" className="bg-gray-800 border-gray-700 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Core Object</Label>
                    <Input value={object} onChange={(e) => setObject(e.target.value)} placeholder="e.g., Drone, Sword, Tablet" className="bg-gray-800 border-gray-700 text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Color Palette</Label>
                    <Input value={colorway} onChange={(e) => setColorway(e.target.value)} placeholder="e.g., Obsidian & Neon Cyan" className="bg-gray-800 border-gray-700 text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Atmospheric Mood</Label>
                    <Input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="e.g., Cyberpunk, Ethereal, Brutalist" className="bg-gray-800 border-gray-700 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep("archetype")} className="text-gray-400">Back</Button>
              <Button size="lg" onClick={handleGenerate} className="bg-blue-600 hover:bg-blue-700 px-8">
                Generate Character <Sparkles className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Generating */}
        {step === "generating" && (
          <div className="text-center py-20 space-y-8">
            <div className="relative w-32 h-32 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-blue-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
              <div className="absolute inset-4 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-blue-400 animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Synthesizing Protocol Entity...</h2>
              <p className="text-gray-400 max-w-sm mx-auto">
                Our neural engines are crafting four high-fidelity variants of your {selectedArchetype?.name}. This usually takes 15-20 seconds.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Selection */}
        {step === "select" && generationStatus.data && (
          <div className="space-y-8">
            <h2 className="text-xl font-semibold text-center">Select Your Preferred Avatar</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {generationStatus.data.assets.map((asset: any) => {
                const isSelected = selectedAssetId === asset.id;
                return (
                  <Card 
                    key={asset.id}
                    className={`overflow-hidden cursor-pointer transition-all ${
                      isSelected ? "ring-4 ring-blue-500" : "hover:scale-[1.02] border-gray-800"
                    } bg-gray-900`}
                    onClick={() => setSelectedAssetId(asset.id)}
                  >
                    <div className="aspect-square relative">
                      <img src={asset.imageUrl} alt="Variant" className="w-full h-full object-cover" />
                      {asset.totalScore && (
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold border border-white/10">
                          SCORE: {asset.totalScore}
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                          {[
                            { label: "Protocol Fit", value: asset.protocolFitScore ? parseFloat(asset.protocolFitScore) * 10 : asset.scoreClarity },
                            { label: "Silhouette", value: asset.silhouetteScore ? parseFloat(asset.silhouetteScore) * 10 : asset.scoreSilhouette },
                            { label: "Trust", value: asset.trustSymbolismScore ? parseFloat(asset.trustSymbolismScore) * 10 : asset.scoreUiCompat },
                            { label: "Mint Ready", value: asset.mintReadinessScore ? parseFloat(asset.mintReadinessScore) * 10 : asset.scoreMintReady },
                            { label: "UI Compat", value: asset.uiCompatibilityScore ? parseFloat(asset.uiCompatibilityScore) * 10 : asset.scoreProtocolAlign },
                          ].map((s) => (
                            <div key={s.label} className="flex justify-between text-gray-400">
                              <span>{s.label}</span>
                              <span className={`font-mono ${(s.value || 0) >= 75 ? "text-emerald-400" : (s.value || 0) >= 50 ? "text-amber-400" : "text-red-400"}`}>
                                {s.value ?? "..."}
                              </span>
                            </div>
                          ))}
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-1 text-blue-400 text-sm pt-1">
                            <Check className="w-4 h-4" /> Selected
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="flex justify-center">
              <Button
                size="lg"
                disabled={!selectedAssetId || selectMutation.isPending}
                onClick={handleSelect}
                className="bg-blue-600 hover:bg-blue-700 px-8"
              >
                {selectMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing Mint...</>
                ) : (
                  <>Select & Prepare for Mint <ChevronRight className="w-4 h-4 ml-1" /></>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Name Agent */}
        {step === "name" && selectedArchetype && (
          <div className="max-w-lg mx-auto space-y-6">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Name Your Protocol Agent</CardTitle>
                <CardDescription>Give your {selectedArchetype.name} a unique identity on the network</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-gray-300">Agent Name</Label>
                  <Input
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder={`e.g., ${selectedArchetype.name} Alpha, Aegis-${selectedArchetype.key.slice(0, 3).toUpperCase()}-001`}
                    className="bg-gray-800 border-gray-700 text-white"
                    maxLength={64}
                  />
                </div>
                <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="w-4 h-4 text-blue-400" />
                    <span className="text-gray-300">Starting XP: <span className="text-white font-mono">100</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span className="text-gray-300">Reputation: <span className="text-white font-mono">100</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="w-4 h-4 text-amber-400" />
                    <span className="text-gray-300">QRON Rewards: <span className="text-white font-mono">0.50 per verification</span></span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-center">
              <Button
                size="lg"
                disabled={agentName.length < 2 || createAgentMutation.isPending}
                onClick={handleCreateAgent}
                className="bg-gradient-to-r from-blue-600 to-yellow-600 hover:from-blue-700 hover:to-yellow-600 px-8"
              >
                {createAgentMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deploying...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Deploy Agent to Network</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 6: Complete */}
        {step === "complete" && (
          <div className="text-center space-y-6 max-w-lg mx-auto">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
              <Check className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
              Agent Deployed!
            </h2>
            <p className="text-gray-400">
              Your protocol agent <span className="text-white font-semibold">{agentName}</span> is now active on the AuthiChain verification network. 
              Start verifying products to earn QRON rewards.
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <a href="/character">View Dashboard</a>
              </Button>
              <Button asChild variant="outline" className="border-gray-700 text-gray-300">
                <a href="/network">Network Stats</a>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
