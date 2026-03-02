import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Loader2, Plus, Key, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function WhiteLabel() {
  const { data: clients, isLoading } = trpc.whiteLabel.list.useQuery();
  const createClient = trpc.whiteLabel.create.useMutation();
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ companyName: "", domain: "", primaryColor: "#00FF88", apiCallLimit: "10000" });

  const handleCreate = async () => {
    if (!form.companyName) { toast.error("Company name required"); return; }
    try {
      await createClient.mutateAsync({
        companyName: form.companyName,
        domain: form.domain || undefined,
        primaryColor: form.primaryColor || undefined,
        apiCallLimit: parseInt(form.apiCallLimit) || 10000,
      });
      toast.success("White-label client created");
      setOpen(false);
      setForm({ companyName: "", domain: "", primaryColor: "#00FF88", apiCallLimit: "10000" });
      utils.whiteLabel.list.invalidate();
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("API key copied");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">White-Label Solutions</h1>
          <p className="text-muted-foreground text-sm mt-1">Enterprise clients with custom branding and API access</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> New Client</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create White-Label Client</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Company Name</Label><Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="mt-1" /></div>
              <div><Label>Domain (optional)</Label><Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className="mt-1" placeholder="auth.company.com" /></div>
              <div><Label>Primary Color</Label><Input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="mt-1 h-10" /></div>
              <div><Label>API Call Limit</Label><Input type="number" value={form.apiCallLimit} onChange={(e) => setForm({ ...form, apiCallLimit: e.target.value })} className="mt-1" /></div>
              <Button className="w-full" onClick={handleCreate} disabled={createClient.isPending}>
                {createClient.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Building2 className="mr-2 h-4 w-4" />} Create Client
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : clients && clients.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {clients.map((c: any) => (
            <Card key={c.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{c.companyName}</h3>
                    {c.domain && <p className="text-xs text-muted-foreground">{c.domain}</p>}
                  </div>
                  <Badge variant="outline" className={c.status === "active" ? "border-green-500/30 text-green-400" : "border-yellow-500/30 text-yellow-400"}>
                    {c.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1"><Key className="h-3 w-3" /> API Key</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs">{c.apiKey?.substring(0, 12)}...</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyKey(c.apiKey)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">API Calls</span>
                    <span>{c.apiCallsUsed ?? 0} / {c.apiCallLimit}</span>
                  </div>
                  {c.primaryColor && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Brand Color</span>
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: c.primaryColor }} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">No White-Label Clients</h3>
            <p className="text-sm text-muted-foreground">Create your first enterprise client to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
