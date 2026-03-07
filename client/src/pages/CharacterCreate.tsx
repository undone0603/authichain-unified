import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Sparkles, Shield, BookOpen, Eye, Compass, Scale, Check, Star, Zap, ChevronRight } from "lucide-react";

const ARCHETYPES = [
  { key: "guardian" as const, name: "Guardian", icon: Shield, color: "from-blue-500 to-blue-700", description: "Protects brand integrity and product authenticity", abilities: ["Verify", "Protect", "Alert"] },
  { key: "archivist" as const, name: "Archivist", icon: BookOpen, color: "from-purple-500 to-purple-700", description: "Records and preserves provenance data on-chain", abilities: ["Record", "Archive", "Query"] },
  { key: "sentinel" as const, name: "Sentinel", icon: Eye, color: "from-red-500 to-red-700", description: "Monitors supply chain integrity in real-time", abilities: ["Monitor", "Detect", "Respond"] },
  { key: "scout" as const, name: "Scout", icon: Compass, color: "from-emerald-500 to-emerald-700", description: "Discovers counterfeits and maps threat networks", abilities: ["Scan", "Discover", "Map"] },
  { key: "arbiter" as const, name: "Arbiter", icon: Scale, color: "from-amber-500 to-amber-700", description: "Resolves disputes and renders consensus verdicts", abilities: ["Judge", "Resolve", "Settle"] },
];

type Step = "archetype" | "context" | "generating" | "select" | "name" | "complete";

export default function CharacterCreate() {
  const [step, setStep] = useState<Step>("archetype");
  const [selectedArchetype, setSelectedArchetype] = useState<typeof ARCHETYPES[number] | null>(null);
  const [brand, setBrand] = useState("");
  const [object, setObject] = useState("");
  const [generationId, setGenerationId] = useState<number | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [agentName, setAgentName] = useState("");

  const generateMutation = trpc.character.generate.useMutation({
    onSuccess: (data) => {
      setGenerationId(data.generationId);
      setStep("generating");
      toast.success("Character generation started!");
    },
    onError: (err) => toast.error(err.message),
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
    onError: (err) => toast.error(err.message),
  });

  const createAgentMutation = trpc.character.createAgent.useMutation({
    onSuccess: () => {
      setStep("complete");
      toast.success("Protocol agent created!");
    },
    onError: (err) => toast.error(err.message),
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
      brand: brand || undefined,
      object: object || undefined,
    });
  };

  const handleSelect = () => {
    if (!selectedAssetId) return;
    selectMutation.mutate({ assetId: selectedAssetId });
  };

  const handleCreateAgent = () => {
    if (!selectedAssetId || !agentName || !selectedArchetype) return;
    createAgentMutation.mutate({
      characterAssetId: selectedAssetId,
      name: agentName,
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
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-white">{arch.name}</h3>
                      <p className="text-sm text-gray-400 mt-1">{arch.description}</p>
                      <div className="flex gap-1.5 mt-3">
                        {arch.abilities.map((a) => (
                          <Badge key={a} variant="outline" className="text-xs border-gray-700 text-gray-300">{a}</Badge>
                        ))}
                      </div>
                      {isSelected && (
                        <div className="mt-3 flex items-center gap-1 text-blue-400 text-sm">
                          <Check className="w-4 h-4" /> Selected
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="flex justify-center">
              <Button
                size="lg"
                disabled={!selectedArchetype}
                onClick={() => setStep("context")}
                className="bg-blue-600 hover:bg-blue-700 px-8"
              >
                Continue <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Context */}
        {step === "context" && selectedArchetype && (
          <div className="max-w-lg mx-auto space-y-6">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Customize Your {selectedArchetype.name}</CardTitle>
                <CardDescription>Optional context to personalize your character's appearance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-gray-300">Brand Name (optional)</Label>
                  <Input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g., LVMH, Pfizer, Nike"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">The brand your agent will protect</p>
                </div>
                <div>
                  <Label className="text-gray-300">Product Type (optional)</Label>
                  <Input
                    value={object}
                    onChange={(e) => setObject(e.target.value)}
                    placeholder="e.g., luxury handbag, pharmaceutical, sneaker"
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">The type of product being authenticated</p>
                </div>
              </CardContent>
            </Card>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setStep("archetype")} className="border-gray-700 text-gray-300">
                Back
              </Button>
              <Button
                size="lg"
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate 4 Variants</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Generating */}
        {step === "generating" && (
          <div className="text-center space-y-6">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center animate-pulse">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold">Generating Your {selectedArchetype?.name}</h2>
            <p className="text-gray-400">
              Creating 4 unique variants with AI scoring... This may take 30-60 seconds.
            </p>
            <div className="flex items-center justify-center gap-2 text-blue-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>
                {generationStatus.data?.status === "generating" ? "Generating variants..." :
                 generationStatus.data?.status === "completed" ? "Complete!" :
                 generationStatus.data?.status === "failed" ? "Generation failed" :
                 "Initializing..."}
              </span>
            </div>
            {generationStatus.data?.assets && generationStatus.data.assets.length > 0 && (
              <p className="text-sm text-gray-500">{generationStatus.data.assets.length} / 4 variants ready</p>
            )}
            {generationStatus.data?.status === "failed" && (
              <Button onClick={() => setStep("context")} variant="outline" className="border-gray-700 text-gray-300">
                Try Again
              </Button>
            )}
          </div>
        )}

        {/* Step 4: Select Variant */}
        {step === "select" && generationStatus.data?.assets && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-center">Select Your Character</h2>
            <p className="text-center text-gray-400">Each variant has been scored across 7 dimensions. Choose your favorite.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {generationStatus.data.assets.map((asset) => {
                const isSelected = selectedAssetId === asset.id;
                return (
                  <Card
                    key={asset.id}
                    className={`cursor-pointer transition-all hover:scale-[1.01] bg-gray-900/50 border-2 ${
                      isSelected ? "border-blue-500 shadow-lg shadow-blue-500/20" : "border-gray-800 hover:border-gray-700"
                    }`}
                    onClick={() => setSelectedAssetId(asset.id)}
                  >
                    <CardContent className="p-4">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-800 mb-4">
                        <img src={asset.imageUrl} alt="Character variant" className="w-full h-full object-cover" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-white">
                            Score: {asset.totalScore || "Scoring..."}
                          </span>
                          {asset.isRecommended === 1 && (
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                              <Star className="w-3 h-3 mr-1" /> Recommended
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          {[
                            { label: "Iconity", value: asset.scoreIconity },
                            { label: "Trust", value: asset.scoreTrustClarity },
                            { label: "Premium", value: asset.scorePremiumFeel },
                            { label: "Silhouette", value: asset.scoreSilhouette },
                            { label: "UI Compat", value: asset.scoreUiCompat },
                            { label: "Mint Ready", value: asset.scoreMintReady },
                            { label: "Protocol", value: asset.scoreProtocolAlign },
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
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8"
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
