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
    if (!form.name || !form.subject || !form.body) {
      toast.error("Name, subject and body required");
      return;
    }
    try {
      await createCampaign.mutateAsync(form as any);
      toast.success("Campaign created!");
      setCreateOpen(false);
      setForm({ name: "", subject: "", body: "", type: "nurture" });
      utils.emailCampaigns.list.invalidate();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  };

  const handleGenerate = async () => {
    if (!genForm.topic) {
      toast.error("Topic required");
      return;
    }
    try {
      const result = await generateContent.mutateAsync(genForm as any);
      setGenResult(result);
      toast.success("Content generated");
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    }
  };

  const launchLuxuryMission = async () => {
    try {
      const response = await fetch("/api/agents/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission: "luxury" }),
      });
      if (response.ok) {
        toast.success("Luxury mission launched via AgentZ!");
      } else {
        toast.error("Failed to launch mission.");
      }
    } catch (error) {
      toast.error("An error occurred.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Campaigns</h1>
          <p className="text-muted-foreground">AI-driven outreach and campaign management.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={launchLuxuryMission}>
            Launch Luxury Mission
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Campaign
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns?.map((campaign: any) => (
                <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">{campaign.name}</h3>
                    <p className="text-sm text-muted-foreground">{campaign.subject}</p>
                  </div>
                  <Badge>{campaign.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
