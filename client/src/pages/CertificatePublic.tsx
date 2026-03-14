import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, CheckCircle2, Loader2 } from "lucide-react";

export default function CertificatePublic({ token }: { token: string }) {
  const { data, isLoading, error } = trpc.certificates.verify.useQuery({ certificateNumber: token });

  const cert = data?.certificate;
  const product = data?.product;

  useEffect(() => {
    if (cert && product) {
      document.title = `${product.name} — Verified Certificate | AuthiChain`;
    } else if (cert) {
      document.title = `Certificate ${cert.certificateNumber} | AuthiChain`;
    } else {
      document.title = "Verify Authentication Certificate | AuthiChain";
    }
  }, [cert, product]);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (error || !data || !data.valid) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="p-8 text-center">
          <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Certificate Not Found</h1>
          <p className="text-sm text-muted-foreground">This certificate could not be verified. It may be invalid or expired.</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full border-primary/30">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold gradient-text">AuthiChain</span>
            </div>
            <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold">Verified Authentic</h1>
            <p className="text-sm text-muted-foreground mt-1">This product has been verified on the blockchain</p>
          </div>
          {cert && (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Certificate #</span>
                <span className="text-sm font-mono">{cert.certificateNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="text-sm text-green-400 capitalize">{cert.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Issued</span>
                <span className="text-sm">{new Date(cert.issuedAt).toLocaleDateString()}</span>
              </div>
              {cert.blockchainTxHash && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Blockchain TX</span>
                  <span className="text-xs font-mono truncate max-w-[200px]">{cert.blockchainTxHash}</span>
                </div>
              )}
              {product && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Product</span>
                  <span className="text-sm">{product.name}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
