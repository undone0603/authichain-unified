import { useState, useRef, useCallback, useId } from "react";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Shield, Upload, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Link2, ExternalLink, Layers, ImagePlus, X, Download, FileImage,
} from "lucide-react";
import { toast } from "sonner";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function getResultIcon(r: string) {
  if (r === "authentic")  return <CheckCircle2 className="h-6 w-6 text-green-400" />;
  if (r === "counterfeit") return <XCircle className="h-6 w-6 text-red-400" />;
  return <AlertTriangle className="h-6 w-6 text-yellow-400" />;
}

function getResultColor(r: string) {
  if (r === "authentic")  return "bg-green-500/10 text-green-400 border-green-500/20";
  if (r === "counterfeit") return "bg-red-500/10 text-red-400 border-red-500/20";
  return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── ResultCard ───────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: any }) {
  return (
    <Card className={`border ${getResultColor(result.result)}`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          {getResultIcon(result.result)}
          <div>
            <h3 className="font-semibold text-lg capitalize">{result.result}</h3>
            <p className="text-sm text-muted-foreground">Confidence: {result.confidence}%</p>
          </div>
          <div className="ml-auto relative h-16 w-16">
            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="currentColor" strokeWidth="2" className="text-secondary" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="currentColor" strokeWidth="2"
                strokeDasharray={`${result.confidence}, 100`}
                className={result.result === "authentic" ? "text-green-400" : result.result === "counterfeit" ? "text-red-400" : "text-yellow-400"} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{result.confidence}%</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{result.analysis}</p>
        {result.authenticMarkers?.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-green-400 mb-1">Authentic Markers</p>
            <div className="flex flex-wrap gap-1">
              {result.authenticMarkers.map((m: string, i: number) => (
                <Badge key={i} variant="outline" className="text-xs border-green-500/30 text-green-400">{m}</Badge>
              ))}
            </div>
          </div>
        )}
        {result.redFlags?.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-red-400 mb-1">Red Flags</p>
            <div className="flex flex-wrap gap-1">
              {result.redFlags.map((f: string, i: number) => (
                <Badge key={i} variant="outline" className="text-xs border-red-500/30 text-red-400">{f}</Badge>
              ))}
            </div>
          </div>
        )}
        <p className="text-sm mt-3 p-3 rounded-lg bg-accent/50">{result.recommendation}</p>
        {result.result === "authentic" && (
          <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 text-primary text-sm font-semibold mb-1">
              <Link2 className="h-4 w-4" /> Blockchain Verified
            </div>
            <p className="text-xs text-muted-foreground">
              Eligible for on-chain verification via the Blockchain Hub. Mint an NFT certificate for immutable proof.
            </p>
            <a href="/blockchain" className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline">
              Go to Blockchain Hub <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Single Authentication tab ────────────────────────────────────────────────

function SingleTab() {
  const [productName, setProductName] = useState("");
  const [brand, setBrand]             = useState("");
  const [imageUrl, setImageUrl]       = useState("");
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult]           = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createProduct = trpc.products.create.useMutation();
  const analyze       = trpc.authenticate.analyze.useMutation();
  const { data: history, isLoading: historyLoading } = trpc.authenticate.history.useQuery();

  const resolvedImageUrl = fileDataUrl ?? imageUrl;

  const handleFileSelect = async (file: File) => {
    const dataUrl = await readFileAsDataUrl(file);
    setFileDataUrl(dataUrl);
    if (!productName) setProductName(file.name.replace(/\.[^/.]+$/, ""));
  };

  const handleAuthenticate = async () => {
    if (!productName || !resolvedImageUrl) {
      toast.error("Product name and image are required");
      return;
    }
    setIsAnalyzing(true);
    setResult(null);
    try {
      const product = await createProduct.mutateAsync({ name: productName, brand, imageUrl: resolvedImageUrl });
      const authResult = await analyze.mutateAsync({ productId: product.id, imageUrl: resolvedImageUrl });
      setResult(authResult);
      toast.success("Authentication complete");
    } catch (e: any) {
      toast.error(e.message || "Authentication failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            New Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Product Name</Label>
            <Input placeholder="e.g., Louis Vuitton Neverfull MM" value={productName}
              onChange={e => setProductName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Brand</Label>
            <Input placeholder="e.g., Louis Vuitton" value={brand}
              onChange={e => setBrand(e.target.value)} className="mt-1" />
          </div>

          {/* Image source toggle */}
          <div className="space-y-2">
            <Label>Product Image</Label>
            {/* File upload dropzone */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={async e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file?.type.startsWith("image/")) handleFileSelect(file);
              }}
            >
              {fileDataUrl ? (
                <div className="relative">
                  <img src={fileDataUrl} alt="Preview" className="w-full h-40 object-cover rounded" />
                  <button
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white"
                    onClick={e => { e.stopPropagation(); setFileDataUrl(null); }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <>
                  <FileImage className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Drop image here or click to upload</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">JPG, PNG, WebP supported</p>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={async e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />

            {/* OR URL fallback */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or paste URL</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <Input placeholder="https://example.com/product-image.jpg"
              value={imageUrl} onChange={e => { setImageUrl(e.target.value); setFileDataUrl(null); }}
              disabled={!!fileDataUrl} />
            {imageUrl && !fileDataUrl && (
              <div className="rounded-lg overflow-hidden border border-border">
                <img src={imageUrl} alt="Product" className="w-full h-48 object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
          </div>

          <Button className="w-full" onClick={handleAuthenticate} disabled={isAnalyzing}>
            {isAnalyzing
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
              : <><Upload className="mr-2 h-4 w-4" /> Authenticate Product</>}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {result && <ResultCard result={result} />}
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Authentications</CardTitle></CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : history && history.length > 0 ? (
              <div className="space-y-2">
                {history.slice(0, 10).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/30">
                    <div className="flex items-center gap-2">
                      {getResultIcon(a.result)}
                      <div>
                        <p className="text-sm font-medium capitalize">{a.result}</p>
                        <p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">{a.confidenceScore}%</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No authentications yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Batch Upload tab ─────────────────────────────────────────────────────────

interface BatchItem {
  id: string;
  file: File;
  dataUrl: string;
  name: string;
  brand: string;
  status: "queued" | "processing" | "done" | "error";
  confidence?: number;
  result?: string;
  error?: string;
}

function BatchTab() {
  const [items, setItems]       = useState<BatchItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createProduct = trpc.products.create.useMutation();
  const analyze       = trpc.authenticate.analyze.useMutation();

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    const newItems = await Promise.all(
      imageFiles.map(async file => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        dataUrl: await readFileAsDataUrl(file),
        name: file.name.replace(/\.[^/.]+$/, ""),
        brand: "",
        status: "queued" as const,
      }))
    );
    setItems(prev => [...prev, ...newItems]);
  }, []);

  const updateItem = (id: string, patch: Partial<BatchItem>) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));

  const removeItem = (id: string) =>
    setItems(prev => prev.filter(i => i.id !== id));

  const processAll = async () => {
    const queued = items.filter(i => i.status === "queued");
    if (queued.length === 0) { toast.error("No items queued"); return; }
    setProcessing(true);
    for (const item of queued) {
      updateItem(item.id, { status: "processing" });
      try {
        const product = await createProduct.mutateAsync({
          name: item.name, brand: item.brand, imageUrl: item.dataUrl,
        });
        const authResult = await analyze.mutateAsync({ productId: product.id, imageUrl: item.dataUrl });
        updateItem(item.id, {
          status: "done",
          confidence: authResult.confidence,
          result: authResult.result,
        });
      } catch (e: any) {
        updateItem(item.id, { status: "error", error: e.message ?? "Failed" });
      }
    }
    setProcessing(false);
    toast.success("Batch complete");
  };

  const exportCsv = () => {
    const rows = [
      ["Name", "Brand", "Result", "Confidence%", "Status"],
      ...items.map(i => [i.name, i.brand, i.result ?? "", i.confidence?.toString() ?? "", i.status]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "authichain-batch.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const doneCount   = items.filter(i => i.status === "done").length;
  const errorCount  = items.filter(i => i.status === "error").length;
  const totalCount  = items.length;
  const progress    = totalCount > 0 ? Math.round(((doneCount + errorCount) / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <Card
        className={`border-2 border-dashed transition-colors cursor-pointer ${isDragging ? "border-primary bg-primary/5" : "border-border"}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={async e => {
          e.preventDefault(); setIsDragging(false);
          await addFiles(e.dataTransfer.files);
        }}
      >
        <CardContent className="py-10 flex flex-col items-center text-center">
          <ImagePlus className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Drop product images here</p>
          <p className="text-xs text-muted-foreground mt-1">or click to browse — multiple files supported</p>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        </CardContent>
      </Card>

      {/* Queue */}
      {items.length > 0 && (
        <>
          {/* Progress bar when running */}
          {processing && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Processing {doneCount + errorCount} / {totalCount}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Summary badges */}
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{items.filter(i => i.status === "queued").length} queued</Badge>
            {doneCount > 0 && <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-600">{doneCount} done</Badge>}
            {errorCount > 0 && <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-600">{errorCount} errors</Badge>}
            <div className="ml-auto flex gap-2">
              {items.some(i => i.status === "done") && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={exportCsv}>
                  <Download className="h-3 w-3" /> Export CSV
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs"
                onClick={() => setItems([])} disabled={processing}>
                Clear All
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={processAll}
                disabled={processing || items.every(i => i.status !== "queued")}>
                {processing ? <><Loader2 className="h-3 w-3 animate-spin" /> Processing…</> : <><Layers className="h-3 w-3" /> Authenticate All</>}
              </Button>
            </div>
          </div>

          {/* Item list */}
          <div className="space-y-2">
            {items.map(item => (
              <Card key={item.id} className="border-border">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {/* Thumbnail */}
                    <img src={item.dataUrl} alt={item.name}
                      className="h-12 w-12 rounded object-cover shrink-0 border border-border" />

                    {/* Name / Brand inputs */}
                    <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
                      <Input
                        value={item.name}
                        onChange={e => updateItem(item.id, { name: e.target.value })}
                        placeholder="Product name"
                        className="h-7 text-xs"
                        disabled={item.status !== "queued"}
                      />
                      <Input
                        value={item.brand}
                        onChange={e => updateItem(item.id, { brand: e.target.value })}
                        placeholder="Brand (optional)"
                        className="h-7 text-xs"
                        disabled={item.status !== "queued"}
                      />
                    </div>

                    {/* Status */}
                    <div className="shrink-0 flex items-center gap-2">
                      {item.status === "queued" && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">queued</Badge>
                      )}
                      {item.status === "processing" && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                      )}
                      {item.status === "done" && item.result && (
                        <>
                          {getResultIcon(item.result)}
                          <Badge variant="outline" className={`text-xs ${getResultColor(item.result)}`}>
                            {item.confidence}%
                          </Badge>
                        </>
                      )}
                      {item.status === "error" && (
                        <span className="text-xs text-red-400 max-w-[120px] truncate" title={item.error}>
                          {item.error}
                        </span>
                      )}
                      {item.status === "queued" && (
                        <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-white">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Add product images above to begin batch authentication.
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Authenticate() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Product Authentication</h1>
        <p className="text-muted-foreground text-sm mt-1">
          AI-powered blockchain verification with confidence scoring
        </p>
      </div>

      <Tabs defaultValue="single">
        <TabsList className="mb-4">
          <TabsTrigger value="single" className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Single
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Batch Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single"><SingleTab /></TabsContent>
        <TabsContent value="batch"><BatchTab /></TabsContent>
      </Tabs>
    </div>
  );
}
