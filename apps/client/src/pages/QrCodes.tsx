import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode, Download, Loader2, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function QrCodes() {
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [qrResult, setQrResult] = useState<{ qrCodeDataUrl: string; verifyUrl: string } | null>(null);
  const { data: products, isLoading } = trpc.products.list.useQuery();
  const generateQr = trpc.qrcode.generate.useMutation();

  const handleGenerate = async () => {
    if (!selectedProduct) { toast.error("Select a product first"); return; }
    try {
      const result = await generateQr.mutateAsync({ productId: parseInt(selectedProduct) });
      setQrResult(result);
      toast.success("QR code generated");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate QR code");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">QR Code Management</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate and manage verification QR codes for your products</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              Generate QR Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Select Product</label>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading products...</div>
              ) : products && products.length > 0 ? (
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger><SelectValue placeholder="Choose a product" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name} {p.brand ? `(${p.brand})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">No products found. Authenticate a product first.</p>
              )}
            </div>
            <Button className="w-full" onClick={handleGenerate} disabled={generateQr.isPending || !selectedProduct}>
              {generateQr.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : <><QrCode className="mr-2 h-4 w-4" /> Generate QR Code</>}
            </Button>
          </CardContent>
        </Card>

        {qrResult && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generated QR Code</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-xl">
                <img src={qrResult.qrCodeDataUrl} alt="QR Code" className="w-64 h-64" />
              </div>
              <p className="text-xs text-muted-foreground text-center break-all">{qrResult.verifyUrl}</p>
              <Button variant="outline" onClick={() => {
                const link = document.createElement("a");
                link.href = qrResult.qrCodeDataUrl;
                link.download = "authichain-qr.png";
                link.click();
              }}>
                <Download className="mr-2 h-4 w-4" /> Download QR Code
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
