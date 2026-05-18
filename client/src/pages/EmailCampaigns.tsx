import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Mail, Users, Send, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient } from "@/lib/queryClient";

export default function EmailCampaigns() {
  const { toast } = useToast();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    body: "",
    type: "nurture" as const,
  });

  const { data: campaigns, isLoading } = useQuery<any[]>({
    queryKey: ["/api/email-campaigns"],
  });

  const createCampaign = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/email-campaigns", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-campaigns"] });
      setCreateOpen(false);
      setForm({ name: "", subject: "", body: "", type: "nurture" });
      toast({
        title: "Success",
        description: "Email campaign created successfully",
      });
    },
  });

  const [genForm, setGenForm] = useState({ topic: "", tone: "professional", type: "email" });
  const [genResult, setGenResult] = useState<any>(null);

  const handleCreate = async () => {
    if (!form.name || !form.subject || !form.body) {
      toast({
        title: "Error",
        description: "Name, subject and body required",
        variant: "destructive",
      });
      return;
    }
    try {
      await createCampaign.mutateAsync(form as any);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed",
        variant: "destructive",
      });
    }
  };

  const handleGenerate = async () => {
    if (!genForm.topic) {
      toast({
        title: "Error",
        description: "Topic required",
        variant: "destructive",
      });
      return;
    }
    try {
      const response = await fetch("/api/agents/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission: "luxury" }),
      });
      if (response.ok) {
        toast({
          title: "Success",
          description: "Luxury mission launched via AgentZ!",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to launch mission.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Campaigns</h1>
          <p className="text-muted-foreground">AI-driven outreach and campaign management.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Create Email Campaign</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Campaign Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Summer Outreach"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Campaign Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v: any) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nurture">Nurture</SelectItem>
                    <SelectItem value="outreach">Outreach</SelectItem>
                    <SelectItem value="newsletter">Newsletter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Subject line"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="body">Email Body</Label>
                <Textarea
                  id="body"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Email content..."
                  rows={6}
                />
              </div>
              <Button onClick={handleCreate} disabled={createCampaign.isPending}>
                {createCampaign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Campaign
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
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

        <Card>
          <CardHeader>
            <CardTitle>AI Campaign Generator</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Campaign Topic</Label>
                <Input
                  placeholder="What is this campaign about?"
                  value={genForm.topic}
                  onChange={(e) => setGenForm({ ...genForm, topic: e.target.value })}
                />
              </div>
              <Button className="w-full" onClick={handleGenerate}>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate with AI
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
