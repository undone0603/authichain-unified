import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Video, Loader2, Sparkles, Play, RefreshCw, Coins } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function HeyGen() {
  const { data: status } = trpc.heygen.status.useQuery();
  const { data: avatars, isLoading: avatarsLoading } = trpc.heygen.avatars.useQuery(undefined, {
    enabled: !!status?.configured,
  });
  const { data: voices, isLoading: voicesLoading } = trpc.heygen.voices.useQuery(undefined, {
    enabled: !!status?.configured,
  });
  const generateVideo = trpc.heygen.generateVideo.useMutation();

  const [avatarId, setAvatarId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [backgroundHex, setBackgroundHex] = useState("#1a1a2e");
  const [pendingVideoId, setPendingVideoId] = useState<string | null>(null);
  const [pollEnabled, setPollEnabled] = useState(false);

  const { data: videoStatus, refetch: refetchStatus } = trpc.heygen.videoStatus.useQuery(
    { videoId: pendingVideoId ?? "" },
    { enabled: pollEnabled && !!pendingVideoId, refetchInterval: 5000 }
  );

  useEffect(() => {
    if (videoStatus?.status === "completed" || videoStatus?.status === "failed") {
      setPollEnabled(false);
      if (videoStatus.status === "completed") {
        toast.success("Video ready!");
      } else {
        toast.error("Video generation failed: " + (videoStatus.error ?? "unknown"));
      }
    }
  }, [videoStatus?.status]);

  const handleGenerate = async () => {
    if (!avatarId) { toast.error("Select an avatar"); return; }
    if (!voiceId) { toast.error("Select a voice"); return; }
    if (!script.trim()) { toast.error("Script is required"); return; }
    try {
      const result = await generateVideo.mutateAsync({
        avatarId,
        voiceId,
        script,
        title: title || undefined,
        backgroundHex,
      });
      setPendingVideoId(result.videoId);
      setPollEnabled(true);
      toast.success("Video queued — polling for status…");
    } catch (e: any) {
      toast.error(e.message || "Failed to start generation");
    }
  };

  if (!status?.configured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">AI Avatar Videos</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate AI avatar videos for outreach and marketing</p>
        </div>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Video className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>HeyGen API key not configured. Add <code className="text-xs bg-muted px-1 rounded">HEYGEN_API_KEY</code> to your environment.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isGenerating = generateVideo.isPending || (pollEnabled && videoStatus?.status !== "completed" && videoStatus?.status !== "failed");
  const isCompleted = videoStatus?.status === "completed" && !!videoStatus.video_url;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Avatar Videos</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate professional AI avatar videos for outreach and marketing</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Coins className="h-3 w-3" />
          {status.credits} credits
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Video Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Title (optional)</Label>
                <Input
                  placeholder="e.g. AuthiChain Product Demo"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Avatar</Label>
                {avatarsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading avatars…
                  </div>
                ) : (
                  <Select value={avatarId} onValueChange={setAvatarId}>
                    <SelectTrigger><SelectValue placeholder="Select avatar…" /></SelectTrigger>
                    <SelectContent>
                      {(avatars ?? []).map(a => (
                        <SelectItem key={a.avatar_id} value={a.avatar_id}>{a.avatar_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1">
                <Label>Voice</Label>
                {voicesLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading voices…
                  </div>
                ) : (
                  <Select value={voiceId} onValueChange={setVoiceId}>
                    <SelectTrigger><SelectValue placeholder="Select voice…" /></SelectTrigger>
                    <SelectContent>
                      {(voices ?? []).filter(v => v.language?.startsWith("en")).map(v => (
                        <SelectItem key={v.voice_id} value={v.voice_id}>
                          {v.name} ({v.gender}, {v.language})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1">
                <Label>Background Color</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={backgroundHex}
                    onChange={e => setBackgroundHex(e.target.value)}
                    className="h-9 w-14 rounded cursor-pointer border border-input"
                  />
                  <Input
                    value={backgroundHex}
                    onChange={e => setBackgroundHex(e.target.value)}
                    className="font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Script</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Write what the avatar will say…"
                value={script}
                onChange={e => setScript(e.target.value)}
                rows={8}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">{script.length}/2000</p>
              <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
                {isGenerating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Generate Video</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="min-h-64">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Result</CardTitle>
                {pendingVideoId && !isCompleted && (
                  <Button size="sm" variant="ghost" onClick={() => refetchStatus()} className="gap-1">
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!pendingVideoId && (
                <div className="text-center text-muted-foreground py-12">
                  <Video className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Your generated video will appear here</p>
                </div>
              )}

              {pendingVideoId && !isCompleted && (
                <div className="text-center py-12 space-y-3">
                  <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
                  <div>
                    <p className="font-medium">Rendering video…</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Status: <span className="capitalize">{videoStatus?.status ?? "pending"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Video ID: {pendingVideoId}</p>
                  </div>
                </div>
              )}

              {isCompleted && videoStatus && (
                <div className="space-y-4">
                  <video
                    src={videoStatus.video_url!}
                    controls
                    className="w-full rounded-lg"
                    poster={videoStatus.thumbnail_url ?? undefined}
                  />
                  {videoStatus.duration && (
                    <p className="text-sm text-muted-foreground">Duration: {videoStatus.duration}s</p>
                  )}
                  <div className="flex gap-2">
                    <Button asChild size="sm" className="gap-1" variant="outline">
                      <a href={videoStatus.video_url!} target="_blank" rel="noreferrer">
                        <Play className="h-3 w-3" /> Open
                      </a>
                    </Button>
                    <Button asChild size="sm" className="gap-1">
                      <a href={videoStatus.video_url!} download>Download</a>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base text-muted-foreground">Use Cases</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              {[
                "Cold outreach to luxury brand procurement teams",
                "Personalized demos for enterprise prospects",
                "Grant application intro video for DHS SVIP",
                "Partnership pitch to pharma supply chain leads",
                "Customer onboarding welcome messages",
              ].map((uc, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">▸</span>
                  <span>{uc}</span>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full text-xs"
                onClick={() => setScript(
                  "Hello, I'm reaching out on behalf of AuthiChain — the leading blockchain-powered product authentication platform. We help luxury brands, pharmaceutical companies, and supply chain leaders eliminate counterfeiting and protect consumer trust.\n\nI'd love to show you how we can deploy a custom authentication solution for your products in under 30 days. Would you be open to a brief 15-minute call this week?\n\nVisit authichain.com to learn more. Looking forward to connecting."
                )}
              >
                <Sparkles className="h-3 w-3 mr-1" /> Load Outreach Script
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
