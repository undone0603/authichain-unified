import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Fingerprint, ShieldCheck, ShieldAlert, ShieldX, ExternalLink, Loader2, RefreshCw, Layers, Star, Globe } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function TrustBadge({ score }: { score: number }) {
  if (score >= 90) return <Badge className="bg-green-500 text-white">A — {score}/100</Badge>;
  if (score >= 70) return <Badge className="bg-blue-500 text-white">B — {score}/100</Badge>;
  if (score >= 50) return <Badge className="bg-yellow-500 text-white">C — {score}/100</Badge>;
  return <Badge className="bg-red-500 text-white">F — {score}/100</Badge>;
}

function VerdictIcon({ verdict }: { verdict: string }) {
  if (verdict === "authentic") return <ShieldCheck className="h-5 w-5 text-green-500" />;
  if (verdict === "suspicious") return <ShieldAlert className="h-5 w-5 text-yellow-500" />;
  return <ShieldX className="h-5 w-5 text-red-500" />;
}

// ── Generate Panel ────────────────────────────────────────────────────────────

function GeneratePanel({ products }: { products: { id: number; name: string; brand?: string; category?: string }[] }) {
  const [productId, setProductId] = useState<number | null>(null);
  const [tier, setTier] = useState<"standard" | "premium" | "enterprise" | "pharma">("standard");
  const [category, setCategory] = useState<"luxury_fashion" | "pharma" | "electronics" | "automotive" | "food_bev" | "other">("other");
  const utils = trpc.useUtils();

  const generate = trpc.qron.generate.useMutation({
    onSuccess: (data) => {
      toast.success("QRON generated", { description: `Mode: ${data.mode} | Seed: ${data.seed.slice(0, 12)}…` });
      utils.qron.list.invalidate();
    },
    onError: (e) => toast.error("Generation failed", { description: e.message }),
  });

  const selected = products.find(p => p.id === productId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Fingerprint className="h-4 w-4 text-primary" />
          Generate QRON Fingerprint
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Product</label>
          <Select onValueChange={v => setProductId(Number(v))}>
            <SelectTrigger><SelectValue placeholder="Select product…" /></SelectTrigger>
            <SelectContent>
              {products.map(p => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.brand ? `${p.brand} — ` : ""}{p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Mode Tier</label>
            <Select value={tier} onValueChange={v => setTier(v as typeof tier)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard — Holographic</SelectItem>
                <SelectItem value="premium">Premium — Dimensional</SelectItem>
                <SelectItem value="enterprise">Enterprise — Living</SelectItem>
                <SelectItem value="pharma">Pharma — Temporal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Category</label>
            <Select value={category} onValueChange={v => setCategory(v as typeof category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="luxury_fashion">Luxury Fashion</SelectItem>
                <SelectItem value="pharma">Pharma</SelectItem>
                <SelectItem value="electronics">Electronics</SelectItem>
                <SelectItem value="automotive">Automotive</SelectItem>
                <SelectItem value="food_bev">Food & Bev</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          className="w-full"
          disabled={!productId || generate.isPending}
          onClick={() => {
            if (!selected) return;
            generate.mutate({ productId: selected.id, productName: selected.name, brand: selected.brand ?? undefined, category, tier });
          }}
        >
          {generate.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : "Generate QRON"}
        </Button>

        {generate.data && (
          <div className="rounded-lg border overflow-hidden">
            <img src={generate.data.imageUrl} alt="QRON fingerprint" className="w-full object-contain max-h-48" />
            <div className="p-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Mode: <span className="font-medium text-foreground capitalize">{generate.data.mode}</span></span>
                <span>Seed: <span className="font-mono">{generate.data.seed.slice(0, 12)}…</span></span>
              </div>
              {generate.data.openartUrl && (
                <a href={generate.data.openartUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <Globe className="h-3 w-3" />View on openART
                </a>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Registry Table ────────────────────────────────────────────────────────────

function QRONRow({ row }: { row: any }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <img
              src={row.qron_image_url}
              alt=""
              className="h-10 w-10 rounded object-cover border shrink-0"
            />
            <div>
              <div className="font-medium text-sm">{row.product_name}</div>
              <div className="text-xs text-muted-foreground capitalize">{row.brand ?? "—"} · {row.category ?? "—"}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3"><TrustBadge score={row.trust_score} /></td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1 text-sm">
            <VerdictIcon verdict={row.trust_score >= 70 ? "authentic" : row.trust_score >= 40 ? "suspicious" : "fake"} />
            <span className="text-xs capitalize">{row.trust_score >= 70 ? "authentic" : row.trust_score >= 40 ? "suspicious" : "unregistered"}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{row.qron_mode}</td>
        <td className="px-4 py-3 text-xs">
          <div className="flex gap-3 text-muted-foreground">
            <span className="text-green-600">✓ {row.verified_scan_count}</span>
            <span className="text-red-500">✗ {row.fake_flag_count}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          {row.openart_registered
            ? <Badge variant="outline" className="text-xs gap-1"><Globe className="h-3 w-3" />openART</Badge>
            : <span className="text-xs text-muted-foreground">—</span>
          }
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={6} className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="space-y-2 text-xs">
                <div><span className="text-muted-foreground">QRON ID: </span><span className="font-mono">{row.qron_id}</span></div>
                <div><span className="text-muted-foreground">Seed: </span><span className="font-mono">{row.generation_seed?.slice(0, 24)}…</span></div>
                <div><span className="text-muted-foreground">Fingerprint: </span><span className="font-mono">{row.fingerprint_hash?.slice(0, 20)}…</span></div>
                {row.nft_token_id && <div><span className="text-muted-foreground">NFT: </span><span className="font-mono">{row.nft_token_id}</span></div>}
                {row.first_scan_country && <div><span className="text-muted-foreground">First scan: </span>{row.first_scan_country}</div>}
              </div>
              <div className="flex items-start gap-2">
                <img src={row.qron_image_url} alt="QRON" className="h-24 w-24 rounded border object-cover" />
                <div className="space-y-2">
                  {row.openart_url && (
                    <a href={row.openart_url} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm" className="gap-1 text-xs">
                        <Globe className="h-3 w-3" />openART
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>
                  )}
                  {row.qron_thumbnail_url && (
                    <img src={row.qron_thumbnail_url} alt="thumbnail" className="h-10 w-10 rounded border object-cover" />
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Layer Legend ──────────────────────────────────────────────────────────────

function LayerLegend() {
  const layers = [
    { num: 1, name: "QR Decode", desc: "Product ID + blockchain hash encoded in QR", weight: 20 },
    { num: 2, name: "Blockchain Cert", desc: "ERC-721 NFT ownership on Polygon", weight: 25 },
    { num: 3, name: "Visual Fingerprint", desc: "AI pattern match via pHash + CLIP embeddings", weight: 30 },
    { num: 4, name: "$QRON Community", desc: "Incentivized verifier consensus verdicts", weight: 15 },
    { num: 5, name: "openART Registry", desc: "Public gallery match on qron.space", weight: 10 },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4 text-primary" />
          5-Layer Trust Scoring
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {layers.map(l => (
          <div key={l.num} className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{l.num}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{l.name}</span>
                <span className="text-xs text-muted-foreground">{l.weight}pts</span>
              </div>
              <p className="text-xs text-muted-foreground">{l.desc}</p>
            </div>
          </div>
        ))}
        <Separator />
        <div className="flex items-center justify-between text-xs font-medium">
          <span>Total</span>
          <span>100 pts</span>
        </div>
        <div className="grid grid-cols-4 gap-1 text-xs text-center">
          {[["≥90", "A", "green"], ["≥70", "B", "blue"], ["≥50", "C", "yellow"], ["<50", "F", "red"]].map(([range, grade, color]) => (
            <div key={grade} className={`rounded p-1 bg-${color}-500/10 text-${color}-600 font-medium`}>
              {grade}: {range}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PhysicalAuth() {
  const { data: qronList = [], isLoading: listLoading, refetch } = trpc.qron.list.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();

  const totalRegistered = qronList.length;
  const avgTrust = totalRegistered > 0
    ? Math.round(qronList.reduce((s: number, r: any) => s + (r.trust_score ?? 0), 0) / totalRegistered)
    : 0;
  const atRisk = qronList.filter((r: any) => r.trust_score < 50).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Fingerprint className="h-6 w-6 text-primary" />
          Physical Authentication
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          QRON visual fingerprints + 5-layer forensic trust scoring powered by $QRON and openART
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalRegistered}</div>
            <p className="text-xs text-muted-foreground">Products Registered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{avgTrust}<span className="text-sm text-muted-foreground">/100</span></div>
            <p className="text-xs text-muted-foreground">Avg Trust Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className={`text-2xl font-bold ${atRisk > 0 ? "text-red-500" : "text-green-500"}`}>{atRisk}</div>
            <p className="text-xs text-muted-foreground">At-Risk Products</p>
          </CardContent>
        </Card>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: generate + legend */}
        <div className="space-y-4">
          <GeneratePanel products={products as any} />
          <LayerLegend />
        </div>

        {/* Right: registry */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" />
                QRON Registry
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={listLoading}>
                <RefreshCw className={`h-4 w-4 ${listLoading ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {listLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : qronList.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Fingerprint className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No QRONs generated yet.</p>
                  <p className="text-xs mt-1">Select a product and click Generate QRON.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="px-4 py-2 text-left font-medium">Product</th>
                        <th className="px-4 py-2 text-left font-medium">Trust</th>
                        <th className="px-4 py-2 text-left font-medium">Verdict</th>
                        <th className="px-4 py-2 text-left font-medium">Mode</th>
                        <th className="px-4 py-2 text-left font-medium">Scans</th>
                        <th className="px-4 py-2 text-left font-medium">Registry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {qronList.map((row: any) => <QRONRow key={row.id} row={row} />)}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
