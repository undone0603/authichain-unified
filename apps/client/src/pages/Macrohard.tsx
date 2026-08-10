import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plug, RefreshCw, Send, Database, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Macrohard() {
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = trpc.macrohard.status.useQuery();
  const syncMutation = trpc.macrohard.sync.useMutation();
  const pushEventMutation = trpc.macrohard.pushEvent.useMutation();

  const [syncEntity, setSyncEntity] = useState<"products" | "users" | "inventory" | "all">("all");
  const [queryResource, setQueryResource] = useState("");
  const queryResult = trpc.macrohard.query.useQuery(
    { resource: queryResource },
    { enabled: false }
  );

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync({ entity: syncEntity });
      toast.success(`Synced ${result.synced} ${result.entity} records`);
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    }
  };

  const handleTestEvent = async () => {
    try {
      const result = await pushEventMutation.mutateAsync({
        eventType: "product_authenticated",
        payload: { test: true, timestamp: new Date().toISOString() },
      });
      toast.success(`Test event sent (ID: ${result.eventId ?? "n/a"})`);
    } catch (e: any) {
      toast.error(e.message || "Event push failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">MACROHARD Integration</h1>
          <p className="text-muted-foreground text-sm mt-1">Connect and sync with the MACROHARD internal system</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchStatus()} className="gap-1">
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Connection Status</CardTitle>
            {statusLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : status?.connected ? (
              <Badge variant="default" className="gap-1 bg-green-600">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="h-3 w-3" />
                {status?.configured ? "Unreachable" : "Not Configured"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!status?.configured ? (
            <div className="text-muted-foreground">
              <p>Set the following environment variables to enable MACROHARD integration:</p>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                <li><code className="bg-muted px-1 rounded">MACROHARD_API_URL</code> — Base URL of the MACROHARD API</li>
                <li><code className="bg-muted px-1 rounded">MACROHARD_API_KEY</code> — API key for authentication</li>
              </ul>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <span>Status:</span>
              <span className="font-medium text-foreground">{status.connected ? "Online" : "Offline"}</span>
              {status.version && (
                <>
                  <span>Version:</span>
                  <span className="font-medium text-foreground">{status.version}</span>
                </>
              )}
              {status.error && (
                <>
                  <span>Error:</span>
                  <span className="text-destructive">{status.error}</span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sync Panel */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" /> Data Sync</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Entity to Sync</Label>
              <Select value={syncEntity} onValueChange={(v) => setSyncEntity(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="products">Products</SelectItem>
                  <SelectItem value="users">Users</SelectItem>
                  <SelectItem value="inventory">Inventory</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSync}
              disabled={syncMutation.isPending || !status?.configured}
              className="w-full"
            >
              {syncMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing…</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" /> Sync {syncEntity}</>
              )}
            </Button>
            {syncMutation.data && (
              <p className="text-sm text-green-600">
                Synced {syncMutation.data.synced} records at {new Date(syncMutation.data.timestamp).toLocaleTimeString()}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Event Push Panel */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" /> Push Events</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send AuthiChain events (authentications, certificates, NFT mints) to MACROHARD in real-time.
            </p>
            <div className="text-sm space-y-1">
              <p className="text-muted-foreground">Configured event types:</p>
              <ul className="text-xs space-y-0.5 text-foreground">
                <li>• <code>product_authenticated</code></li>
                <li>• <code>certificate_issued</code></li>
                <li>• <code>nft_minted</code></li>
              </ul>
            </div>
            <Button
              onClick={handleTestEvent}
              disabled={pushEventMutation.isPending || !status?.configured}
              variant="outline"
              className="w-full"
            >
              {pushEventMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
              ) : (
                <><Plug className="mr-2 h-4 w-4" /> Send Test Event</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* API Query */}
      <Card>
        <CardHeader><CardTitle className="text-base">Query MACROHARD API</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Resource path (e.g. products, users/123)"
              value={queryResource}
              onChange={e => setQueryResource(e.target.value)}
              className="flex-1 font-mono text-sm"
            />
            <Button
              variant="outline"
              onClick={() => queryResult.refetch()}
              disabled={!queryResource || !status?.configured}
            >
              Query
            </Button>
          </div>
          {queryResult.data && (
            <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-48">
              {JSON.stringify(queryResult.data, null, 2)}
            </pre>
          )}
          {queryResult.error && (
            <p className="text-sm text-destructive">{queryResult.error.message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
