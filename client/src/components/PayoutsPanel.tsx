import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Wallet, ShieldAlert, ShieldCheck, RefreshCw, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending_approval: "outline",
  approved: "default",
  processing: "secondary",
  paid: "secondary",
  failed: "destructive",
  rejected: "destructive",
  held: "outline",
};

const RAIL_LABEL: Record<string, string> = {
  stripe_connect: "Stripe (fiat)",
  qron_onchain: "$QRON (on-chain)",
  buyback_burn: "Buyback/Burn",
};

export default function PayoutsPanel() {
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: dryRun, isLoading: dryRunLoading } = trpc.payouts.dryRun.useQuery();
  const { data: rows, isLoading: rowsLoading } = trpc.payouts.list.useQuery({
    statuses: ["pending_approval", "approved", "processing", "held", "failed"],
    limit: 200,
  });

  const refresh = () => {
    utils.payouts.dryRun.invalidate();
    utils.payouts.list.invalidate();
  };

  const prepare = trpc.payouts.prepare.useMutation({
    onSuccess: (r) => { toast.success(`Queued ${r.queued} payout(s), skipped ${r.skipped} duplicate(s)`); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const approve = trpc.payouts.approve.useMutation({
    onSuccess: (r) => { toast.success(`Approved ${r.approved} payout(s)`); setSelected(new Set()); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const execute = trpc.payouts.execute.useMutation({
    onSuccess: (s) => {
      if (s.skipped) toast.warning(`Execution skipped: ${s.skipped}`);
      else toast.success(`Paid ${s.paid}, failed ${s.failed}, held ${s.held} (of ${s.attempted} attempted)`);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const pending = (rows ?? []).filter(r => r.status === "pending_approval");
  const approved = (rows ?? []).filter(r => r.status === "approved");
  const payoutsEnabled = dryRun?.payoutsEnabled ?? false;

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAllPending = () => setSelected(new Set(pending.map(p => p.id)));

  return (
    <div className="space-y-4">
      {/* Kill-switch status banner */}
      <Card className={payoutsEnabled ? "border-amber-500/40 bg-amber-500/5" : "border-green-500/30"}>
        <CardContent className="p-4 flex items-center gap-3">
          {payoutsEnabled
            ? <ShieldAlert className="h-5 w-5 text-amber-400" />
            : <ShieldCheck className="h-5 w-5 text-green-400" />}
          <div className="flex-1">
            <p className="text-sm font-medium">
              {payoutsEnabled
                ? "PAYOUTS_ENABLED is ON — approved payouts will move real funds when executed."
                : "PAYOUTS_ENABLED is OFF — execution is blocked; nothing can send."}
            </p>
            {dryRun && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Caps: ${dryRun.caps.maxPerItem}/item · ${dryRun.caps.maxPerRun}/run
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh</Button>
        </CardContent>
      </Card>

      {/* Dry-run preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4" />Eligible Payouts (dry-run)</CardTitle>
          <CardDescription>What would be queued from pending commissions and staking rewards. No funds move.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {dryRunLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : dryRun ? (
            <>
              <div className="grid sm:grid-cols-3 gap-3">
                <Stat label="Total intents" value={dryRun.totalIntents} />
                <Stat label="Within caps" value={dryRun.allowed.count} sub={`$${dryRun.allowed.total.toFixed(2)}`} />
                <Stat label="Held (over caps)" value={dryRun.held.length} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => prepare.mutate()} disabled={prepare.isPending}>
                  {prepare.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                  Prepare / Queue
                </Button>
              </div>
            </>
          ) : <p className="text-xs text-muted-foreground">No preview available.</p>}
        </CardContent>
      </Card>

      {/* Pending approval */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Pending Approval ({pending.length})</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllPending} disabled={pending.length === 0}>Select all</Button>
              <Button
                size="sm"
                onClick={() => approve.mutate({ ids: Array.from(selected) })}
                disabled={selected.size === 0 || approve.isPending}
              >
                {approve.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                Approve {selected.size > 0 ? `(${selected.size})` : ""}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {rowsLoading ? <Loader2 className="h-5 w-5 animate-spin" />
            : pending.length === 0 ? <p className="text-xs text-muted-foreground">Nothing awaiting approval.</p>
            : <PayoutTable rows={pending} selectable selected={selected} onToggle={toggle} />}
        </CardContent>
      </Card>

      {/* Approved → execute */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Approved — ready to send ({approved.length})</CardTitle>
            <Button
              size="sm"
              variant={payoutsEnabled ? "default" : "outline"}
              onClick={() => execute.mutate()}
              disabled={approved.length === 0 || execute.isPending}
              title={payoutsEnabled ? "Send approved payouts" : "Blocked: PAYOUTS_ENABLED is off"}
            >
              {execute.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
              Execute payouts
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {approved.length === 0 ? <p className="text-xs text-muted-foreground">No approved payouts queued.</p>
            : <PayoutTable rows={approved} />}
        </CardContent>
      </Card>
    </div>
  );
}

function PayoutTable({ rows, selectable, selected, onToggle }: {
  rows: any[];
  selectable?: boolean;
  selected?: Set<number>;
  onToggle?: (id: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {selectable && <th className="w-8 py-2 px-2"></th>}
            <th className="text-left py-2 px-2 font-medium">#</th>
            <th className="text-left py-2 px-2 font-medium">Rail</th>
            <th className="text-right py-2 px-2 font-medium">Amount</th>
            <th className="text-left py-2 px-2 font-medium">Destination</th>
            <th className="text-left py-2 px-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/50">
              {selectable && (
                <td className="py-2 px-2">
                  <Checkbox checked={selected?.has(r.id)} onCheckedChange={() => onToggle?.(r.id)} />
                </td>
              )}
              <td className="py-2 px-2 font-mono text-xs text-muted-foreground">#{r.id}</td>
              <td className="py-2 px-2">{RAIL_LABEL[r.rail] ?? r.rail}</td>
              <td className="py-2 px-2 text-right font-medium">{Number(r.amount).toLocaleString()} {r.currency.toUpperCase()}</td>
              <td className="py-2 px-2 font-mono text-xs text-muted-foreground truncate max-w-[180px]">{r.destination ?? "—"}</td>
              <td className="py-2 px-2">
                <Badge variant={STATUS_VARIANT[r.status] ?? "outline"} className="text-xs">{r.status.replace(/_/g, " ")}</Badge>
                {r.failureReason && <span className="block text-[10px] text-muted-foreground mt-0.5">{r.failureReason}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return (
    <div className="p-3 rounded-lg bg-accent/30">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
