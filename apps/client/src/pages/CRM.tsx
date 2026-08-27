import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Users, Building2, Handshake, RefreshCw, Plus, Search,
  CheckCircle2, AlertTriangle, ExternalLink, Mail, Phone
} from "lucide-react";

export default function CRM() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("contacts");

  const status = trpc.hubspot.status.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const contacts = trpc.hubspot.contacts.list.useQuery(undefined, { retry: false, enabled: status.data?.connected === true });
  const companies = trpc.hubspot.companies.list.useQuery(undefined, { retry: false, enabled: status.data?.connected === true });
  const deals = trpc.hubspot.deals.list.useQuery(undefined, { retry: false, enabled: status.data?.connected === true });
  const searchResults = trpc.hubspot.contacts.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 2 && status.data?.connected === true, retry: false }
  );

  const isConnected = status.data?.connected === true;
  const missingScopes = (status.data as any)?.missingScopes as string[] | undefined;
  const hasPermissionError = status.data?.error?.includes("401") || status.data?.error?.includes("403") || status.data?.error?.includes("credentials");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CRM Dashboard</h1>
          <p className="text-muted-foreground">Manage contacts, companies, and deals via HubSpot</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? "default" : "destructive"} className="gap-1">
            {isConnected ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {isConnected ? "HubSpot Connected" : "Not Connected"}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => status.refetch()}>
            <RefreshCw className={`h-4 w-4 ${status.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {!isConnected && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-400">HubSpot Connection Issue</h3>
                {hasPermissionError ? (
                  <p className="text-sm text-muted-foreground mt-1">
                    Your HubSpot API key needs additional permissions. Go to your{" "}
                    <a href="https://app.hubspot.com/private-apps/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      HubSpot Private Apps settings
                    </a>{" "}
                    and ensure the following scopes are enabled: <strong>crm.objects.contacts.read</strong>,{" "}
                    <strong>crm.objects.contacts.write</strong>, <strong>crm.objects.companies.read</strong>,{" "}
                    <strong>crm.objects.companies.write</strong>, <strong>crm.objects.deals.read</strong>,{" "}
                    <strong>crm.objects.deals.write</strong>.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    {status.data?.error || "HUBSPOT_SERVICE_KEY is not configured. Add it in Settings \u2192 Secrets."}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isConnected && missingScopes && missingScopes.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-300">Limited Scopes</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  HubSpot is connected but missing scopes for: <strong>{missingScopes.join(", ")}</strong>.{" "}
                  To enable full CRM access, add these scopes in your{" "}
                  <a href="https://app.hubspot.com/private-apps/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    HubSpot Private Apps settings
                  </a>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contacts</p>
                <p className="text-3xl font-bold text-primary">{status.data?.contacts ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total CRM contacts</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Companies</p>
                <p className="text-3xl font-bold text-primary">{status.data?.companies ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total companies</p>
              </div>
              <Building2 className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Deals</p>
                <p className="text-3xl font-bold text-primary">{status.data?.deals ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active deals</p>
              </div>
              <Handshake className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="deals">Deals</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            {activeTab === "contacts" && (
              <>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    className="pl-9 w-64"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <AddContactDialog />
              </>
            )}
          </div>
        </div>

        <TabsContent value="contacts">
          <ContactsTable contacts={searchQuery.length > 2 ? (searchResults.data || []) : (contacts.data || [])} isConnected={isConnected} />
        </TabsContent>
        <TabsContent value="companies">
          <CompaniesTable companies={companies.data || []} isConnected={isConnected} />
        </TabsContent>
        <TabsContent value="deals">
          <DealsTable deals={deals.data || []} isConnected={isConnected} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AddContactDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", firstname: "", lastname: "", phone: "", company: "" });
  const utils = trpc.useUtils();
  const createContact = trpc.hubspot.contacts.create.useMutation({
    onSuccess: () => {
      toast.success("Contact created in HubSpot");
      utils.hubspot.contacts.list.invalidate();
      utils.hubspot.status.invalidate();
      setOpen(false);
      setForm({ email: "", firstname: "", lastname: "", phone: "", company: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Contact</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add HubSpot Contact</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>First Name</Label><Input value={form.firstname} onChange={e => setForm(p => ({ ...p, firstname: e.target.value }))} /></div>
            <div><Label>Last Name</Label><Input value={form.lastname} onChange={e => setForm(p => ({ ...p, lastname: e.target.value }))} /></div>
          </div>
          <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
          <div><Label>Company</Label><Input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} /></div>
          <Button className="w-full" onClick={() => createContact.mutate(form)} disabled={!form.email || createContact.isPending}>
            {createContact.isPending ? "Creating..." : "Create Contact"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContactsTable({ contacts, isConnected }: { contacts: any[]; isConnected: boolean }) {
  if (!isConnected) return <Card><CardContent className="py-12 text-center text-muted-foreground">Connect HubSpot to view contacts</CardContent></Card>;
  if (contacts.length === 0) return <Card><CardContent className="py-12 text-center text-muted-foreground">No contacts found</CardContent></Card>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Contacts</CardTitle><p className="text-sm text-muted-foreground">All contacts synced from HubSpot CRM</p></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground">
              <th className="text-left py-3 px-2">Name</th>
              <th className="text-left py-3 px-2">Email</th>
              <th className="text-left py-3 px-2">Company</th>
              <th className="text-left py-3 px-2">Status</th>
              <th className="text-left py-3 px-2">Created</th>
              <th className="text-left py-3 px-2">Actions</th>
            </tr></thead>
            <tbody>
              {contacts.map((c: any) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 px-2 font-medium">{[c.firstname, c.lastname].filter(Boolean).join(" ") || "—"}</td>
                  <td className="py-3 px-2"><span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email || "—"}</span></td>
                  <td className="py-3 px-2">{c.company || "—"}</td>
                  <td className="py-3 px-2"><Badge variant="outline" className="text-xs">{c.hs_lead_status || "NEW"}</Badge></td>
                  <td className="py-3 px-2 text-muted-foreground">{c.createdate ? new Date(c.createdate).toLocaleDateString() : "—"}</td>
                  <td className="py-3 px-2">
                    <a href={`https://app.hubspot.com/contacts/${c.id}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm"><ExternalLink className="h-3 w-3" /></Button>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CompaniesTable({ companies, isConnected }: { companies: any[]; isConnected: boolean }) {
  if (!isConnected) return <Card><CardContent className="py-12 text-center text-muted-foreground">Connect HubSpot to view companies</CardContent></Card>;
  if (companies.length === 0) return <Card><CardContent className="py-12 text-center text-muted-foreground">No companies found. Add company scopes to your HubSpot private app to enable this feature.</CardContent></Card>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Companies</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground">
              <th className="text-left py-3 px-2">Name</th>
              <th className="text-left py-3 px-2">Domain</th>
              <th className="text-left py-3 px-2">Industry</th>
              <th className="text-left py-3 px-2">Created</th>
            </tr></thead>
            <tbody>
              {companies.map((c: any) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 px-2 font-medium">{c.name || "—"}</td>
                  <td className="py-3 px-2">{c.domain || "—"}</td>
                  <td className="py-3 px-2">{c.industry || "—"}</td>
                  <td className="py-3 px-2 text-muted-foreground">{c.createdate ? new Date(c.createdate).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function DealsTable({ deals, isConnected }: { deals: any[]; isConnected: boolean }) {
  if (!isConnected) return <Card><CardContent className="py-12 text-center text-muted-foreground">Connect HubSpot to view deals</CardContent></Card>;
  if (deals.length === 0) return <Card><CardContent className="py-12 text-center text-muted-foreground">No deals found. Add deal scopes to your HubSpot private app to enable this feature.</CardContent></Card>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Deals Pipeline</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground">
              <th className="text-left py-3 px-2">Deal Name</th>
              <th className="text-left py-3 px-2">Amount</th>
              <th className="text-left py-3 px-2">Stage</th>
              <th className="text-left py-3 px-2">Close Date</th>
            </tr></thead>
            <tbody>
              {deals.map((d: any) => (
                <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-3 px-2 font-medium">{d.dealname || "—"}</td>
                  <td className="py-3 px-2">{d.amount ? `$${Number(d.amount).toLocaleString()}` : "—"}</td>
                  <td className="py-3 px-2"><Badge variant="outline" className="text-xs">{d.dealstage || "—"}</Badge></td>
                  <td className="py-3 px-2 text-muted-foreground">{d.closedate ? new Date(d.closedate).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
