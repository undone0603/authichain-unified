import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Loader2, Plus, Send, Sparkles, Eye, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function EmailCampaigns() {
  const { data: campaigns, isLoading } = trpc.emailCampaigns.list.useQuery();
  const { data: drafts } = trpc.emailDrafts.listPending.useQuery();
  const createCampaign = trpc.emailCampaigns.create.useMutation();
  const generateContent = trpc.emailCampaigns.generateContent.useMutation();
  const utils = trpc.useUtils();

  const [createOpen, setCreateOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [form, setForm] = useState({ name: "", subject: "", body: "", type: "nurture" });
  const [genForm, setGenForm] = useState({ topic: "", tone: "professional", type: "email" });
  const [genResult, setGenResult] = useState<any>(null);

  const handleCreate = async () => {
    if (!form.name || !form.subject || !form.body) { toast.error("Name, subject and body required"); return; }
    try {
      await createCampaign.mutateAsync({ name: form.name, subject: form.subject, body: form.body, type: form.type as any });
      toast.success("Campaign created");
      setCreateOpen(false);
      setForm({ name: "", subject: "", body: "", type: "nurture" });
      utils.emailCampaigns.list.invalidate();
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const handleGenerate = async () => {
    if (!genForm.topic) { toast.error("Topic required"); return; }
    try {
      const result = await generateContent.mutateAsync(genForm as any);
      setGenResult(result);
      toast.success("Content generated");
    } catch (e: any) { toast.error(e.message || "Generation failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Campaigns</h1>
          <p className="text-muted-foreground text-sm mt-1">AI-powered email campaigns with approval workflows</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={genOpen} onOpenChange={setGenOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm" className="bg-transparent"><Sparkles className="mr-1 h-4 w-4" /> AI Generate</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>AI Content Generator</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Topic</Label><Input value={genForm.topic} onChange={(e) => setGenForm({ ...genForm, topic: e.target.value })} placeholder="e.g., Product authentication benefits" className="mt-1" /></div>
                <div>
                  <Label>Content Type</Label>
                  <Select value={genForm.type} onValueChange={(v) => setGenForm({ ...genForm, type: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="social_post">Social Post</SelectItem>
                      <SelectItem value="blog_article">Blog Article</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tone</Label>
                  <Select value={genForm.tone} onValueChange={(v) => setGenForm({ ...genForm, tone: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleGenerate} disabled={generateContent.isPending}>
                  {generateContent.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Generate Content
                </Button>
                {genResult && (
                  <div className="mt-3 p-3 rounded-lg bg-accent/50 space-y-2">
                    {genResult.subject && <p className="text-sm font-medium">Subject: {genResult.subject}</p>}
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{genResult.content}</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> New Campaign</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
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
                      <SelectItem value="trial_conversion">Trial Conversion</SelectItem>
                      <SelectItem value="onboarding">Onboarding</SelectItem>
                      <SelectItem value="re_engagement">Re-engagement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={createCampaign.isPending}>
                  {createCampaign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />} Create Campaign
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns ({campaigns?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="drafts">Drafts ({drafts?.length ?? 0})</TabsTrigger>
        </TabsList>

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
                    {(c.sentCount > 0 || c.openRate || c.clickRate) && (
                      <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                        {c.sentCount > 0 && <span>Sent: {c.sentCount}</span>}
                        {c.openRate && <span>Open: {c.openRate}%</span>}
                        {c.clickRate && <span>Click: {c.clickRate}%</span>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-1">No Campaigns Yet</h3>
                <p className="text-sm text-muted-foreground">Create your first email campaign to get started.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="drafts" className="mt-4">
          {drafts && drafts.length > 0 ? (
            <div className="space-y-3">
              {drafts.map((d: any) => (
                <Card key={d.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-sm">{d.subject || "Untitled Draft"}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 capitalize">{d.contentType} · {d.tone}</p>
                      </div>
                      <Badge variant="outline" className={d.approvalStatus === "approved" ? "border-green-500/30 text-green-400" : "border-yellow-500/30 text-yellow-400"}>
                        {d.approvalStatus}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-1">No Drafts</h3>
                <p className="text-sm text-muted-foreground">Use AI Generate to create email content.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
