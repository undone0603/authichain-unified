import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, Download, Loader2, Camera, Upload, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";

// ─── Generate Tab ─────────────────────────────────────────────────────────────

function GenerateTab() {
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
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading products...
              </div>
            ) : products && products.length > 0 ? (
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger><SelectValue placeholder="Choose a product" /></SelectTrigger>
                <SelectContent>
                  {products.map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.name} {p.brand ? `(${p.brand})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">No products found. Authenticate a product first.</p>
            )}
          </div>
          <Button className="w-full" onClick={handleGenerate} disabled={generateQr.isPending || !selectedProduct}>
            {generateQr.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
              : <><QrCode className="mr-2 h-4 w-4" /> Generate QR Code</>}
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
  );
}

// ─── Scan Tab ─────────────────────────────────────────────────────────────────

type ScanState = "idle" | "scanning" | "done" | "error";

interface ScanResult {
  raw: string;
  isAuthichain: boolean;
  verifyUrl: string | null;
}

const AUTHICHAIN_RE = /authichain\.com\/verify/i;

function parseScanResult(raw: string): ScanResult {
  const isAuthichain = AUTHICHAIN_RE.test(raw);
  let verifyUrl: string | null = null;
  try {
    const u = new URL(raw);
    if (isAuthichain) verifyUrl = u.toString();
  } catch { /* not a URL */ }
  return { raw, isAuthichain, verifyUrl };
}

function ScanTab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const frameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string>("");
  const [hasBarcodeDetector] = useState(() => "BarcodeDetector" in window);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (frameRef.current) { cancelAnimationFrame(frameRef.current); frameRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) { videoRef.current.srcObject = null; }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // BarcodeDetector scan loop
  const startScanLoop = useCallback(async (video: HTMLVideoElement) => {
    if (!detectorRef.current) {
      detectorRef.current = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
    }
    const detect = async () => {
      if (!streamRef.current) return;
      try {
        const codes: any[] = await detectorRef.current.detect(video);
        if (codes.length > 0) {
          stopCamera();
          setResult(parseScanResult(codes[0].rawValue));
          setScanState("done");
          return;
        }
      } catch { /* frame not ready */ }
      frameRef.current = requestAnimationFrame(detect);
    };
    frameRef.current = requestAnimationFrame(detect);
  }, [stopCamera]);

  // Start camera
  const handleStartCamera = useCallback(async () => {
    if (!hasBarcodeDetector) return;
    setScanState("scanning");
    setResult(null);
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current!.play();
          startScanLoop(videoRef.current!);
        };
      }
    } catch (e: any) {
      setError(e.message || "Camera access denied");
      setScanState("error");
    }
  }, [hasBarcodeDetector, startScanLoop]);

  const handleStopCamera = useCallback(() => {
    stopCamera();
    setScanState("idle");
  }, [stopCamera]);

  // File upload fallback — draw to canvas, BarcodeDetector.detect(canvas)
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanState("scanning");
    setResult(null);
    setError("");
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0);

      if (hasBarcodeDetector) {
        if (!detectorRef.current) {
          detectorRef.current = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        }
        const codes: any[] = await detectorRef.current.detect(canvas);
        if (codes.length === 0) throw new Error("No QR code found in image");
        setResult(parseScanResult(codes[0].rawValue));
        setScanState("done");
      } else {
        // Fallback: use zxing-like approach via URL embed + prompt
        throw new Error("BarcodeDetector not supported. Use Chrome/Edge to scan QR codes.");
      }
    } catch (e: any) {
      setError(e.message || "Could not decode QR code");
      setScanState("error");
    }
    e.target.value = "";
  }, [hasBarcodeDetector]);

  const handleReset = () => {
    stopCamera();
    setScanState("idle");
    setResult(null);
    setError("");
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Camera / upload card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            Snap to Scan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Camera viewfinder */}
          <div
            className={`relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center border-2 transition-colors ${
              scanState === "scanning" ? "border-primary" : "border-border"
            }`}
          >
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${scanState === "scanning" ? "block" : "hidden"}`}
              muted
              playsInline
            />
            {scanState !== "scanning" && (
              <div className="flex flex-col items-center gap-2 text-muted-foreground p-8 text-center">
                <Camera className="h-10 w-10 opacity-30" />
                <p className="text-sm">
                  {hasBarcodeDetector
                    ? "Point your camera at a QR code or upload an image"
                    : "Upload an image containing a QR code"}
                </p>
              </div>
            )}
            {/* Crosshair overlay */}
            {scanState === "scanning" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-white/70 rounded-lg" />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {hasBarcodeDetector && scanState !== "scanning" && (
              <Button className="flex-1" onClick={handleStartCamera}>
                <Camera className="mr-2 h-4 w-4" /> Use Camera
              </Button>
            )}
            {scanState === "scanning" && (
              <Button variant="outline" className="flex-1" onClick={handleStopCamera}>
                Stop Camera
              </Button>
            )}
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={scanState === "scanning"}
            >
              <Upload className="mr-2 h-4 w-4" /> Upload Image
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {scanState === "scanning" && (
            <p className="text-xs text-center text-muted-foreground animate-pulse">
              Scanning… hold steady over the QR code
            </p>
          )}
          {scanState === "error" && (
            <p className="text-xs text-center text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Result card */}
      {(scanState === "done" || scanState === "error") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scan Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {scanState === "done" && result ? (
              <>
                <div className={`flex items-center gap-2 text-sm font-medium ${result.isAuthichain ? "text-green-600" : "text-yellow-600"}`}>
                  {result.isAuthichain
                    ? <><CheckCircle className="h-4 w-4" /> Authichain QR Code Detected</>
                    : <><XCircle className="h-4 w-4" /> Non-Authichain QR Code</>}
                </div>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs font-mono break-all">{result.raw}</p>
                </div>
                {result.verifyUrl && (
                  <Button asChild className="w-full">
                    <a href={result.verifyUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" /> Open Verify Page
                    </a>
                  </Button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <XCircle className="h-4 w-4" /> {error}
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={handleReset}>
              Scan Another
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QrCodes() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">QR Code Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate verification QR codes for your products or scan existing ones
        </p>
      </div>

      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate" className="gap-2">
            <QrCode className="h-4 w-4" /> Generate
          </TabsTrigger>
          <TabsTrigger value="scan" className="gap-2">
            <Camera className="h-4 w-4" /> Snap to Scan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="mt-6">
          <GenerateTab />
        </TabsContent>

        <TabsContent value="scan" className="mt-6">
          <ScanTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
