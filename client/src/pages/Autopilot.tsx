import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Bot, Loader2, Zap, Mail, MessageSquare, Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Autopilot() {
  const { data: config, isLoading } = trpc.autopilot.getStatus.useQuery();
  const { data: decisions } = trpc.autopilot.getDecisions.useQuery({ limit: 20 });
  const updateMode = trpc.autopilot.updateMode.useMutation();
  const toggleAutopilot = trpc.autopilot.toggle.useMutation();
  const executeAction = trpc.autopilot.executeAction.useMutation();
  const utils = trpc.useUtils();

  const [mode, setMode] = useState<string>(config?.mode ?? "balanced");
  const [enabled, setEnabled] = useState(!!config?.enabled);

  const handleSaveConfig = async () => {
    try {
      await updateMode.mutateAsync({ mode: mode as any });
      toast.success("Autopilot configuration saved");
      utils.autopilot.getStatus.invalidate();
    } catch (e: any) { toast.error(e.message || "Failed to save"); }
  };

  const handleToggle = async () => {
    try {
      const result = await toggleAutopilot.mutateAsync();
      setEnabled(!!result.enabled);
      toast.success(result.enabled ? "Autopilot enabled" : "Autopilot disabled");
      utils.autopilot.getStatus.invalidate();
    } catch (e: any) { toast.error(e.message || "Toggle failed"); }
  };

  const handleRunDecision = async (type: string) => {
    try {
      const result = await executeAction.mutateAsync({ type, action: `Execute ${type} automation` });
      toast.success("Action executed successfully");
      utils.autopilot.getDecisions.invalidate();
    } catch (e: any) { toast.error(e.message || "Decision failed"); }
  };

  const decisionTypes = [
    { type: "email_outreach", label: "Email Outreach", icon: Mail, desc: "AI-generated email campaigns to qualified leads" },
    { type: "lead_qualification", label: "Lead Qualification", icon: Target, desc: "Score and qualify leads based on engagement data" },
    { type: "social_engagement", label: "Social Engagement", icon: MessageSquare, desc: "Automated social media responses and engagement" },
    { type: "content_creation", label: "Content Creation", icon: Zap, desc: "AI-generated blog posts and marketing content" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Autopilot</h1>
        <p className="text-muted-foreground text-sm mt-1">Automated decision engine for marketing and sales</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" /> Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Autopilot Enabled</span>
                  <Switch checked={enabled} onCheckedChange={handleToggle} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Mode</label>
                  <Select value={mode} onValueChange={setMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="aggressive">Aggressive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleSaveConfig} disabled={updateMode.isPending}>
                  {updateMode.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save Configuration
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {decisionTypes.map((d) => (
                  <button
                    key={d.type}
                    onClick={() => handleRunDecision(d.type)}
                    disabled={executeAction.isPending}
                    className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-accent/50 transition-colors text-left"
                  >
                    <d.icon className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{d.label}</p>
                      <p className="text-xs text-muted-foreground">{d.desc}</p>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Decisions</CardTitle>
              </CardHeader>
              <CardContent>
                {decisions && decisions.length > 0 ? (
                  <div className="space-y-3">
                    {decisions.map((d: any) => (
                      <div key={d.id} className="p-3 rounded-lg bg-accent/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">{d.decisionType.replace(/_/g, " ")}</span>
                          <Badge variant="outline" className={d.status === "executed" ? "border-green-500/30 text-green-400" : "border-yellow-500/30 text-yellow-400"}>
                            {d.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{d.action}</p>
                        {d.confidence && <p className="text-xs text-muted-foreground">Confidence: {d.confidence}%</p>}
                        <p className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No decisions yet. Run a quick action to get started.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
