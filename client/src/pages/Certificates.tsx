import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Certificates() {
  const { data: certs, isLoading } = trpc.certificates.list.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Certificates</h1>
        <p className="text-muted-foreground text-sm mt-1">View and manage your product authentication certificates</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : certs && certs.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certs.map((cert: any) => (
            <Card key={cert.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <Award className="h-5 w-5 text-primary" />
                  <Badge variant="outline" className={cert.status === "valid" ? "border-green-500/30 text-green-400" : "border-yellow-500/30 text-yellow-400"}>
                    {cert.status}
                  </Badge>
                </div>
                <h3 className="font-semibold text-sm mb-1 truncate">{cert.certificateNumber}</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Issued: {new Date(cert.issuedAt).toLocaleDateString()}
                  {cert.expiresAt && <> · Expires: {new Date(cert.expiresAt).toLocaleDateString()}</>}
                </p>
                {cert.blockchainTxHash && (
                  <p className="text-xs text-muted-foreground truncate mb-3">TX: {cert.blockchainTxHash}</p>
                )}
                <Button variant="outline" size="sm" className="w-full bg-transparent" onClick={() => window.open(`/certificate/${cert.verificationToken}`, "_blank")}>
                  <ExternalLink className="mr-2 h-3.5 w-3.5" /> View Certificate
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Award className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">No Certificates Yet</h3>
            <p className="text-sm text-muted-foreground">Certificates are issued after successful product authentication.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
