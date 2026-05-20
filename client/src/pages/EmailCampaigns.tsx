import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Loader2, Plus, Send, Sparkles, XCircle, Rocket, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function EmailCampaigns() {
  const { data: campaigns, isLoading } = trpc.emailCampaigns.list.useQuery();
  const { data: drafts, refetch: refetchDrafts } = trpc.emailDrafts.listPending.useQuery();
  const createCampaign = trpc.emailCampaigns.create.useMutation({
    onSuccess: () => { toast.success("Campaign created!"); setCreateOpen(false); setForm({ name: "", subject: "", body: "", type: "nurture" }); },
    onError: (e) => toast.error(e.message),
  });
  const generateContent = trpc.emailCampaigns.generateContent.useMutation({
    onSuccess: (res) => setGenResult(res),
    onError: (e) => toast.error(e.message),
  });
  const approveDraft = trpc.emailDrafts.approve.useMutation({
    onSuccess: () => { toast.success("Draft approved and sent!"); refetchDrafts(); },
    onError: (e) => toast.error(e.message),
  });
  const rejectDraft = trpc.emailDrafts.reject.useMutation({
    onSuccess: () => { toast.success("Draft rejected"); refetchDrafts(); },
    onError: (e) => toast.error(e.message),
  });
  const triggerMission = trpc.missions.create.useMutation({
    onSuccess: (res) => toast.success(`Mission ${res.id} started! AgentZ is now finding leads.`),
    onError: (e) => toast.error(e.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [form, setForm] = useState({ name: "", subject: "", body: "", type: "nurture" });
  const [genForm, setGenForm] = useState({ topic: "", targetAudience: "", type: "outreach" });
  const [genResult, setGenResult] = useState<any>(null);

  const handleCreate = () => {
    if (!form.name || !form.subject || !form.body) {
      toast.error("Name, subject and body required");
      return;
    }
    createCampaign.mutate(form as any);
  };

  const handleGenerate = () => {
    if (!genForm.topic) {
      toast.error("Topic required");
      return;
    }
    generateContent.mutate(genForm as any);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cold Outreach Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">AgentZ AI Outreach & Mission Control</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={genOpen} onOpenChange={setGenOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm" className="bg-transparent"><Sparkles className="mr-1 h-4 w-4" /> AI Content</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>AI Outreach Generator</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Focus Topic</Label><Input value={genForm.topic} onChange={(e) => setGenForm({ ...genForm, topic: e.target.value })} placeholder="e.g., Anti-counterfeit for luxury handbags" className="mt-1" /></div>
                <div><Label>Target Audience</Label><Input value={genForm.targetAudience} onChange={(e) => setGenForm({ ...genForm, targetAudience: e.target.value })} placeholder="e.g., C-level at luxury brands" className="mt-1" /></div>
                <Button className="w-full" onClick={handleGenerate} disabled={generateContent.isPending}>
                  {generateContent.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Generate Sequence
                </Button>
                {genResult && (
                  <div className="mt-3 p-3 rounded-lg bg-accent/50 space-y-2 max-h-[300px] overflow-auto">
                    <p className="text-sm font-bold">Subject: {genResult.subject}</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{genResult.body}</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> New Campaign</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Custom Campaign</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Campaign Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
                <div><Label>Subject Line</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="mt-1" /></div>
                <div><Label>Body</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="mt-1" rows={4} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nurture">Lead Nurture</SelectItem>
                      <SelectItem value="outreach">Cold Outreach</SelectItem>
                      <SelectItem value="announcement">Announcement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={createCampaign.isPending}>
                  {createCampaign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />} Save Campaign
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Mission Control Strip */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2"><Rocket className="h-4 w-4 text-primary" /> LUXURY SEGMENT</CardTitle>
              <Badge variant="outline" className="text-[10px]">ACTIVE ICP</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Trigger AgentZ to find high-end luxury brand leads and start the Bayesian-optimized sequence.</p>
            <Button className="w-full h-8 text-xs font-bold" onClick={() => triggerMission.mutate({ type: "LUXURY_OUTREACH" as any })} disabled={triggerMission.isPending}>
              {triggerMission.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Zap className="h-3 w-3 mr-2" />} LAUNCH LUXURY MISSION
            </Button>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2"><Rocket className="h-4 w-4 text-blue-400" /> PHARMA SEGMENT</CardTitle>
              <Badge variant="outline" className="text-[10px]">ACTIVE ICP</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Find compliance officers at pharma manufacturers. Focus: DSCSA 2027 compliance mandates.</p>
            <Button variant="outline" className="w-full h-8 text-xs font-bold border-blue-500/30 text-blue-400" onClick={() => triggerMission.mutate({ type: "PHARMA_OUTREACH" as any })} disabled={triggerMission.isPending}>
              {triggerMission.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Zap className="h-3 w-3 mr-2" />} LAUNCH PHARMA MISSION
            </Button>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2"><Rocket className="h-4 w-4 text-yellow-500" /> MEDTECH SEGMENT</CardTitle>
              <Badge variant="outline" className="text-[10px] text-yellow-500 border-yellow-500/30">BIG TICKET ($150K)</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Target Quality Directors at device manufacturers. Pitch: ISO 13485 + Automated ROI Calculator.</p>
            <Button className="w-full h-8 text-xs font-bold bg-yellow-600 hover:bg-yellow-700 text-black" onClick={() => triggerMission.mutate({ type: "MEDTECH_OUTREACH" as any })} disabled={triggerMission.isPending}>
              {triggerMission.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Zap className="h-3 w-3 mr-2" />} LAUNCH MEDTECH MISSION
            </Button>
          </CardContent>
        </Card>
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2"><Rocket className="h-4 w-4 text-purple-400" /> TIMEPIECE SEGMENT</CardTitle>
              <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-500/30">PRESTIGE ($75K)</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Target Independent Watch Brands. Pitch: Gray Market Prevention + Resale Trust Shield.</p>
            <Button variant="outline" className="w-full h-8 text-xs font-bold border-purple-500/40 text-purple-400 hover:bg-purple-500/10" onClick={() => triggerMission.mutate({ type: "TIMEPIECE_OUTREACH" as any })} disabled={triggerMission.isPending}>
              {triggerMission.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Zap className="h-3 w-3 mr-2" />} LAUNCH TIMEPIECE MISSION
            </Button>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="drafts">
        <TabsList>
          <TabsTrigger value="drafts" className="gap-2">Pending Review <Badge variant="secondary" className="h-5 px-1.5">{drafts?.length ?? 0}</Badge></TabsTrigger>
          <TabsTrigger value="campaigns">All Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="drafts" className="mt-4">
          {drafts && drafts.length > 0 ? (
            <div className="grid gap-4">
              {drafts.map((d: any) => (
                <Card key={d.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/30 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm">{d.prospectName || "New Prospect"} ({d.prospectCompany || "Unknown Corp"})</CardTitle>
                        <CardDescription className="text-xs">{d.prospectEmail}</CardDescription>
                      </div>
                      <Badge variant="outline" className="bg-background">Generated by AgentZ</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Subject</p>
                      <p className="text-sm font-medium">{d.subject}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Message Body</p>
                      <div className="p-3 rounded border bg-muted/20 text-sm whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-auto">
                        {d.body}
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button className="flex-1 gap-2" size="sm" onClick={() => approveDraft.mutate({ id: d.id })} disabled={approveDraft.isPending}>
                        <Send className="h-3.5 w-3.5" /> Approve & Send
                      </Button>
                      <Button variant="outline" className="flex-1 gap-2 border-red-500/20 text-red-500 hover:bg-red-500/10" size="sm" onClick={() => rejectDraft.mutate({ id: d.id })} disabled={rejectDraft.isPending}>
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold">No Pending Drafts</h3>
                <p className="text-sm text-muted-foreground max-w-xs text-center mt-1">
                  Launch a <strong>Mission</strong> above to start generating personalized outreach drafts via AgentZ.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : campaigns && campaigns.length > 0 ? (
            <div className="space-y-3">
              {campaigns.map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-sm">{c.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.subject}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">{c.type}</Badge>
                        <Badge variant="outline" className={c.status === "sent" ? "border-green-500/30 text-green-400" : c.status === "active" ? "border-blue-500/30 text-blue-400" : "border-yellow-500/30 text-yellow-400"}>
                          {c.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No custom campaigns yet.</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
