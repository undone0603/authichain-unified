import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, Upload, Loader2, CheckCircle2, XCircle, AlertTriangle, Link2, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Authenticate() {
  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const createProduct = trpc.products.create.useMutation();
  const analyze = trpc.authenticate.analyze.useMutation();
  const { data: history, isLoading: historyLoading } = trpc.authenticate.history.useQuery();

  const handleAuthenticate = async () => {
    if (!productName || !imageUrl) { toast.error("Product name and image URL are required"); return; }
    setIsAnalyzing(true);
    setResult(null);
    try {
      const product = await createProduct.mutateAsync({ name: productName, brand, imageUrl });
      const authResult = await analyze.mutateAsync({ productId: product.id, imageUrl });
      setResult(authResult);
      toast.success("Authentication complete");
    } catch (e: any) {
      toast.error(e.message || "Authentication failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getResultIcon = (r: string) => {
    if (r === "authentic") return <CheckCircle2 className="h-6 w-6 text-green-400" />;
    if (r === "counterfeit") return <XCircle className="h-6 w-6 text-red-400" />;
    return <AlertTriangle className="h-6 w-6 text-yellow-400" />;
  };

  const getResultColor = (r: string) => {
    if (r === "authentic") return "bg-green-500/10 text-green-400 border-green-500/20";
    if (r === "counterfeit") return "bg-red-500/10 text-red-400 border-red-500/20";
    return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Product Authentication</h1>
        <p className="text-muted-foreground text-sm mt-1">AI-powered blockchain verification with confidence scoring</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Authentication Form */}
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
              <Input placeholder="e.g., Louis Vuitton Neverfull MM" value={productName} onChange={(e) => setProductName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Brand</Label>
              <Input placeholder="e.g., Louis Vuitton" value={brand} onChange={(e) => setBrand(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Image URL</Label>
              <Input placeholder="https://example.com/product-image.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Provide a direct URL to the product image for AI analysis</p>
            </div>
            {imageUrl && (
              <div className="rounded-lg overflow-hidden border border-border">
                <img src={imageUrl} alt="Product" className="w-full h-48 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
            <Button className="w-full" onClick={handleAuthenticate} disabled={isAnalyzing}>
              {isAnalyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</> : <><Upload className="mr-2 h-4 w-4" /> Authenticate Product</>}
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        <div className="space-y-4">
          {result && (
            <Card className={`border ${getResultColor(result.result)}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  {getResultIcon(result.result)}
                  <div>
                    <h3 className="font-semibold text-lg capitalize">{result.result}</h3>
                    <p className="text-sm text-muted-foreground">Confidence: {result.confidence}%</p>
                  </div>
                  <div className="ml-auto">
                    <div className="relative h-16 w-16">
                      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" className="text-secondary" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={`${result.confidence}, 100`} className={result.result === "authentic" ? "text-green-400" : result.result === "counterfeit" ? "text-red-400" : "text-yellow-400"} />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{result.confidence}%</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{result.analysis}</p>
                {result.authenticMarkers?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-green-400 mb-1">Authentic Markers</p>
                    <div className="flex flex-wrap gap-1">
                      {result.authenticMarkers.map((m: string, i: number) => <Badge key={i} variant="outline" className="text-xs border-green-500/30 text-green-400">{m}</Badge>)}
                    </div>
                  </div>
                )}
                {result.redFlags?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-red-400 mb-1">Red Flags</p>
                    <div className="flex flex-wrap gap-1">
                      {result.redFlags.map((f: string, i: number) => <Badge key={i} variant="outline" className="text-xs border-red-500/30 text-red-400">{f}</Badge>)}
                    </div>
                  </div>
                )}
                <p className="text-sm mt-3 p-3 rounded-lg bg-accent/50">{result.recommendation}</p>
                {result.result === "authentic" && (
                  <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-2 text-primary text-sm font-semibold mb-1">
                      <Link2 className="h-4 w-4" />
                      Blockchain Verified
                    </div>
                    <p className="text-xs text-muted-foreground">This authentication result is eligible for on-chain verification via the Blockchain Hub. Mint an NFT certificate to create an immutable proof of authenticity.</p>
                    <a href="/blockchain" className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline">
                      Go to Blockchain Hub <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Authentications</CardTitle>
            </CardHeader>
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
    </div>
  );
}
