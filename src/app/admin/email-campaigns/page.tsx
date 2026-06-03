'use client';

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
import { Mail, Loader2, Plus, Send, Sparkles, XCircle, Rocket, Zap, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";

export default function EmailCampaignsPage() {
  const { data: campaigns, isLoading } = trpc.emailCampaigns.list.useQuery();
  const { data: drafts, refetch: refetchDrafts } = trpc.emailDrafts.listPending.useQuery();
  
  const createCampaign = trpc.emailCampaigns.create.useMutation({
    onSuccess: () => { 
      toast.success("Campaign created!"); 
      setCreateOpen(false); 
      setForm({ name: "", subject: "", body: "", type: "nurture" }); 
    },
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
    onSuccess: (res: any) => toast.success(`Mission ${res.id} started! AgentZ is now finding leads.`),
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
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <Link href="/admin" className="flex items-center gap-2 text-zinc-500 hover:text-gold transition-colors text-[10px] font-black uppercase tracking-widest mb-4">
              <ChevronLeft className="w-3 h-3" /> Back to Dashboard
            </Link>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Cold Outreach <span className="gold-text">Mission Control</span></h1>
            <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-1">Autonomous Revenue Engine v2.1</p>
          </div>
          
          <div className="flex gap-3">
            <Dialog open={genOpen} onOpenChange={setGenOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-gold hover:border-gold/30">
                  <Sparkles className="mr-2 h-4 w-4" /> AI Content
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-950 border-zinc-900 text-white">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black uppercase tracking-tighter">AI Outreach Generator</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Focus Topic</Label>
                    <Input 
                      value={genForm.topic} 
                      onChange={(e) => setGenForm({ ...genForm, topic: e.target.value })} 
                      placeholder="e.g., Anti-counterfeit for luxury handbags" 
                      className="bg-zinc-900 border-zinc-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Target Audience</Label>
                    <Input 
                      value={genForm.targetAudience} 
                      onChange={(e) => setGenForm({ ...genForm, targetAudience: e.target.value })} 
                      placeholder="e.g., C-level at luxury brands" 
                      className="bg-zinc-900 border-zinc-800"
                    />
                  </div>
                  <Button 
                    className="w-full bg-gold hover:bg-yellow-500 text-black font-black uppercase tracking-widest" 
                    onClick={handleGenerate} 
                    disabled={generateContent.isPending}
                  >
                    {generateContent.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Generate Sequence
                  </Button>
                  {genResult && (
                    <div className="mt-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 max-h-[300px] overflow-auto">
                      <p className="text-xs font-black uppercase text-gold">Subject: {genResult.subject}</p>
                      <p className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">{genResult.body}</p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gold hover:bg-yellow-500 text-black font-black uppercase tracking-widest">
                  <Plus className="mr-2 h-4 w-4" /> New Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-950 border-zinc-900 text-white">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black uppercase tracking-tighter">Create Custom Campaign</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Campaign Name</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-zinc-900 border-zinc-800" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Subject Line</Label>
                    <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="bg-zinc-900 border-zinc-800" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Body</Label>
                    <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="bg-zinc-900 border-zinc-800 min-h-[150px]" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                        <SelectItem value="nurture">Lead Nurture</SelectItem>
                        <SelectItem value="outreach">Cold Outreach</SelectItem>
                        <SelectItem value="announcement">Announcement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="w-full bg-gold hover:bg-yellow-500 text-black font-black uppercase tracking-widest" 
                    onClick={handleCreate} 
                    disabled={createCampaign.isPending}
                  >
                    {createCampaign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />} Save Campaign
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {/* Mission Control Strip */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { id: "LUXURY_OUTREACH", name: "Luxury Segment", desc: "Target high-end fashion and accessory brands.", color: "border-gold/20 bg-gold/5", icon: Rocket, badge: "ACTIVE ICP" },
            { id: "PHARMA_OUTREACH", name: "Pharma Segment", desc: "Target compliance officers for DSCSA 2027 mandates.", color: "border-blue-500/20 bg-blue-500/5", icon: Rocket, badge: "ACTIVE ICP", iconColor: "text-blue-400" },
            { id: "MEDTECH_OUTREACH", name: "MedTech Segment", desc: "Target Quality Directors. Big Ticket ($150K).", color: "border-emerald-500/20 bg-emerald-500/5", icon: Rocket, badge: "HIGH ROI", iconColor: "text-emerald-400" },
            { id: "TIMEPIECE_OUTREACH", name: "Timepiece Segment", desc: "Target Independent Watch Brands. Prestige ($75K).", color: "border-purple-500/20 bg-purple-500/5", icon: Rocket, badge: "PRESTIGE", iconColor: "text-purple-400" },
          ].map((m) => (
            <Card key={m.id} className={`${m.color} border border-zinc-900/50 backdrop-blur-sm`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <m.icon className={`h-4 w-4 ${m.iconColor || 'text-gold'}`} /> {m.name}
                  </CardTitle>
                  <Badge variant="outline" className="text-[8px] font-black border-zinc-800 text-zinc-500">{m.badge}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-[10px] text-zinc-500 font-bold uppercase leading-relaxed tracking-tight">{m.desc}</p>
                <Button 
                  className="w-full h-10 text-[10px] font-black uppercase tracking-widest bg-zinc-950 border border-zinc-800 hover:border-gold/40 hover:text-gold transition-all"
                  onClick={() => triggerMission.mutate({ type: m.id as any })} 
                  disabled={triggerMission.isPending}
                >
                  {triggerMission.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Zap className="h-3 w-3 mr-2 text-gold" />} Launch Mission
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="drafts" className="w-full">
          <TabsList className="bg-zinc-950 border border-zinc-900 p-1 rounded-xl h-12">
            <TabsTrigger value="drafts" className="gap-2 px-6 data-[state=active]:bg-zinc-900 data-[state=active]:text-gold rounded-lg font-black uppercase text-[10px] tracking-widest">
              Pending Review <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-zinc-800 text-zinc-400 border-none">{drafts?.length ?? 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="px-6 data-[state=active]:bg-zinc-900 data-[state=active]:text-gold rounded-lg font-black uppercase text-[10px] tracking-widest">
              All Campaigns
            </TabsTrigger>
          </TabsList>

          <TabsContent value="drafts" className="mt-8">
            {drafts && drafts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {drafts.map((d: any) => (
                  <Card key={d.id} className="bg-zinc-950 border-zinc-900 overflow-hidden group hover:border-gold/20 transition-all">
                    <CardHeader className="bg-zinc-900/30 pb-4 border-b border-zinc-900">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm font-black uppercase text-white">{d.prospectName || "New Prospect"}</CardTitle>
                          <CardDescription className="text-[10px] font-bold text-zinc-500 uppercase mt-1">{d.prospectCompany || "Unknown Corp"} &bull; {d.prospectEmail}</CardDescription>
                        </div>
                        <Badge variant="outline" className="text-[8px] font-black bg-zinc-900 border-zinc-800 text-zinc-600">AGENTZ GENERATED</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="space-y-2">
                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Subject</p>
                        <p className="text-xs font-bold text-zinc-200">{d.subject}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Message Body</p>
                        <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-900/20 text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed max-h-[250px] overflow-auto scrollbar-hide">
                          {d.body}
                        </div>
                      </div>
                      <div className="flex gap-4 pt-2">
                        <Button 
                          className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] tracking-widest" 
                          onClick={() => approveDraft.mutate({ id: d.id })} 
                          disabled={approveDraft.isPending}
                        >
                          <Send className="h-3.5 w-3.5" /> Approve & Send
                        </Button>
                        <Button 
                          variant="outline" 
                          className="flex-1 gap-2 border-red-500/20 text-red-500 hover:bg-red-500/10 font-black uppercase text-[10px] tracking-widest" 
                          onClick={() => rejectDraft.mutate({ id: d.id })} 
                          disabled={rejectDraft.isPending}
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-zinc-950 border-zinc-900 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-24">
                  <div className="h-16 w-16 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
                    <Mail className="h-8 w-8 text-zinc-700" />
                  </div>
                  <h3 className="font-black uppercase tracking-widest text-zinc-400">No Pending Drafts</h3>
                  <p className="text-[10px] text-zinc-600 max-w-xs text-center mt-2 uppercase font-bold tracking-tight">
                    Launch an autonomous <strong>Mission</strong> above to start generating personalized outreach drafts via AgentZ.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="campaigns" className="mt-8">
            {isLoading ? (
              <div className="flex justify-center py-24"><Loader2 className="h-12 w-12 animate-spin text-gold" /></div>
            ) : campaigns && campaigns.length > 0 ? (
              <div className="space-y-4">
                {campaigns.map((c: any) => (
                  <Card key={c.id} className="bg-zinc-950 border-zinc-900 hover:bg-zinc-900/30 transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                           <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                              <Mail className="w-5 h-5 text-zinc-500" />
                           </div>
                           <div>
                              <h3 className="font-black text-white uppercase text-sm">{c.name}</h3>
                              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mt-1">{c.subject}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-[8px] font-black uppercase border-zinc-800 text-zinc-500">{c.type}</Badge>
                          <Badge variant="outline" className={`text-[8px] font-black uppercase px-3 py-1 ${
                            c.status === "sent" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : 
                            c.status === "active" ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : 
                            "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                          }`}>
                            {c.status}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-zinc-950 border-zinc-900"><CardContent className="py-24 text-center text-zinc-600 font-black uppercase tracking-widest text-xs">No custom campaigns yet.</CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
