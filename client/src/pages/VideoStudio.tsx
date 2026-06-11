import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Video, Wand2, Copy, Play, CheckCircle2, Clock, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

// ─── Library tab ─────────────────────────────────────────────────────────────

function VideoCard({ video }: { video: any }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const statusIcon = {
    completed: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />,
    processing: <Clock className="h-3.5 w-3.5 text-yellow-400 animate-pulse" />,
    waiting:    <Clock className="h-3.5 w-3.5 text-yellow-400 animate-pulse" />,
    pending:    <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
    failed:     <XCircle className="h-3.5 w-3.5 text-red-400" />,
  }[video.status as string] ?? <Clock className="h-3.5 w-3.5 text-muted-foreground" />;

  const copyUrl = () => {
    if (!video.video_url) return;
    navigator.clipboard.writeText(video.video_url);
    toast.success("URL copied");
  };

  return (
    <Card className="overflow-hidden">
      <div className="relative bg-black aspect-video">
        {playing && video.video_url ? (
          <video
            ref={videoRef}
            src={video.video_url}
            autoPlay
            controls
            className="w-full h-full object-cover"
            onEnded={() => setPlaying(false)}
          />
        ) : (
          <>
            {video.thumbnail_url
              ? <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center bg-accent/20"><Video className="h-8 w-8 text-muted-foreground" /></div>
            }
            {video.status === "completed" && video.video_url && (
              <button
                onClick={() => setPlaying(true)}
                className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/60 transition-colors"
              >
                <Play className="h-10 w-10 text-white fill-white" />
              </button>
            )}
          </>
        )}
      </div>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium line-clamp-1">{video.title || video.video_id}</p>
          <div className="flex items-center gap-1 shrink-0">
            {statusIcon}
            <span className="text-xs text-muted-foreground capitalize">{video.status}</span>
          </div>
        </div>
        {video.duration && (
          <p className="text-xs text-muted-foreground">{video.duration.toFixed(1)}s</p>
        )}
        <div className="flex gap-2">
          {video.video_url && (
            <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={copyUrl}>
              <Copy className="h-3 w-3 mr-1" /> Copy URL
            </Button>
          )}
          {video.video_url && (
            <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button variant="outline" size="sm" className="h-7 text-xs w-full">
                Download
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LibraryTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch, isRefetching } = trpc.heygen.videos.useQuery({ page });

  if (isLoading) return (
    <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
  );

  const videos = data?.videos ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} video{total !== 1 ? "s" : ""} in your HeyGen account</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isRefetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {videos.length === 0
        ? <div className="text-center py-16 text-muted-foreground text-sm">No videos yet — generate your first one.</div>
        : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((v: any) => <VideoCard key={v.video_id} video={v} />)}
          </div>
        )
      }

      {total > 50 && (
        <div className="flex justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-sm self-center">Page {page}</span>
          <Button variant="outline" size="sm" disabled={videos.length < 50} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

// ─── Generate tab ─────────────────────────────────────────────────────────────

function GenerateTab() {
  const { data: avatars, isLoading: loadingAvatars } = trpc.heygen.avatars.useQuery();
  const { data: voices, isLoading: loadingVoices } = trpc.heygen.voices.useQuery();

  const [avatarId, setAvatarId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");

  // Script drafting
  const [draftFirst, setDraftFirst] = useState("");
  const [draftCompany, setDraftCompany] = useState("");
  const [draftSegment, setDraftSegment] = useState("RETAIL");

  const draftMutation = trpc.heygen.draftScript.useMutation({
    onSuccess: (res) => { setScript(res.script); toast.success("Script drafted"); },
    onError: (e) => toast.error(e.message),
  });

  const generateMutation = trpc.heygen.generateVideo.useMutation({
    onSuccess: (res) => {
      toast.success(`Video queued! ID: ${res.videoId} — check Library in ~2 min.`);
      setScript(""); setTitle("");
    },
    onError: (e) => toast.error(e.message),
  });

  // Poll status for pending video
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { data: pending } = trpc.heygen.videoStatus.useQuery(
    { videoId: pendingId! },
    { enabled: !!pendingId, refetchInterval: 8_000 },
  );

  if (pending?.status === "completed" && pendingId) {
    toast.success("Video ready! Check the Library tab.");
    setPendingId(null);
  }

  const handleGenerate = () => {
    if (!avatarId || !voiceId || !script || !title) {
      toast.error("Fill in all fields first");
      return;
    }
    generateMutation.mutate({ avatarId, voiceId, script, title }, {
      onSuccess: (r) => setPendingId(r.videoId),
    });
  };

  const enVoices = (voices ?? []).filter((v: any) => v.language?.startsWith("en"));
  const displayVoices = enVoices.length > 0 ? enVoices : (voices ?? []);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Left: Config */}
      <div className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Avatar & Voice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Avatar</Label>
              {loadingAvatars
                ? <div className="h-9 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading avatars...</div>
                : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {(avatars ?? []).map((a: any) => (
                      <button
                        key={a.avatar_id}
                        onClick={() => setAvatarId(a.avatar_id)}
                        className={`relative rounded-lg overflow-hidden border-2 transition-colors text-left ${
                          avatarId === a.avatar_id ? "border-primary" : "border-transparent"
                        }`}
                      >
                        {a.preview_image_url
                          ? <img src={a.preview_image_url} alt={a.avatar_name} className="w-full aspect-square object-cover" />
                          : <div className="w-full aspect-square bg-accent/30 flex items-center justify-center text-[10px] text-muted-foreground p-1 text-center">{a.avatar_name}</div>
                        }
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                          <p className="text-[10px] text-white truncate">{a.avatar_name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )
              }
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Voice</Label>
              {loadingVoices
                ? <div className="h-9 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading voices...</div>
                : (
                  <Select value={voiceId} onValueChange={setVoiceId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select a voice..." />
                    </SelectTrigger>
                    <SelectContent>
                      {displayVoices.map((v: any) => (
                        <SelectItem key={v.voice_id} value={v.voice_id}>
                          {v.name} — {v.language} {v.gender}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              }
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Aspect Ratio</Label>
              <Select value={aspectRatio} onValueChange={v => setAspectRatio(v as any)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 Landscape (email / web)</SelectItem>
                  <SelectItem value="9:16">9:16 Portrait (LinkedIn / mobile)</SelectItem>
                  <SelectItem value="1:1">1:1 Square (social)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: Script + Generate */}
      <div className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              Script
              <Badge variant="outline" className="text-xs font-normal">
                {script.length} / 500 chars
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* AI draft helpers */}
            <div className="rounded-lg bg-accent/20 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">AI Draft for a Lead</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">First name</Label>
                  <Input className="h-8 text-sm" value={draftFirst} onChange={e => setDraftFirst(e.target.value)} placeholder="Alex" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Company</Label>
                  <Input className="h-8 text-sm" value={draftCompany} onChange={e => setDraftCompany(e.target.value)} placeholder="Acme Corp" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Segment</Label>
                <Select value={draftSegment} onValueChange={setDraftSegment}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GOV">Government</SelectItem>
                    <SelectItem value="RETAIL">Retail</SelectItem>
                    <SelectItem value="PRESS">Press / Media</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="w-full h-8 text-xs"
                disabled={draftMutation.isPending || !draftFirst || !draftCompany}
                onClick={() => draftMutation.mutate({ firstName: draftFirst, company: draftCompany, segment: draftSegment })}
              >
                {draftMutation.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Drafting...</>
                  : <><Wand2 className="h-3.5 w-3.5 mr-1.5" /> Write script with AI</>
                }
              </Button>
            </div>

            <Textarea
              className="text-sm resize-none"
              rows={6}
              placeholder="Or type your script here. Keep it under 80 words (≈30 sec)."
              value={script}
              onChange={e => setScript(e.target.value.slice(0, 500))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Video title</Label>
              <Input
                className="h-9 text-sm"
                placeholder="e.g. Outreach — Alex @ Acme Corp"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={generateMutation.isPending || !avatarId || !voiceId || !script || !title}
              onClick={handleGenerate}
            >
              {generateMutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                : <><Video className="h-4 w-4 mr-2" /> Generate Video</>
              }
            </Button>
            {pendingId && (
              <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-400/10 rounded-md px-3 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Processing video {pendingId.slice(0, 12)}… (~2 min)
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VideoStudio() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Video Studio</h1>
        <p className="text-muted-foreground text-sm mt-1">
          HeyGen AI avatar videos — library &amp; on-demand generation
        </p>
      </div>

      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="generate">Generate</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-5">
          <LibraryTab />
        </TabsContent>

        <TabsContent value="generate" className="mt-5">
          <GenerateTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
