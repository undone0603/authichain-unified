import { trpc } from "@/lib/trpc";
import { Shield, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VerifyWidgetProps {
  certificateNumber: string;
  theme?: "dark" | "light";
  compact?: boolean;
}

/**
 * AuthiChain Embeddable Verification Widget
 * This can be dropped into any brand's product page.
 */
export default function VerifyWidget({ certificateNumber, theme = "dark", compact = false }: VerifyWidgetProps) {
  const { data: cert, isLoading, error } = trpc.certificates.verify.useQuery({ certificateNumber });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  if (error || !cert) return null;

  const isDark = theme === "dark";

  if (compact) {
    return (
      <a 
        href={`https://authichain.com/verify/${certificateNumber}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all hover:scale-105 ${
          isDark 
            ? "bg-black/40 border-primary/30 text-primary hover:border-primary" 
            : "bg-white border-primary/20 text-primary-foreground bg-primary hover:shadow-md"
        }`}
      >
        <Shield className="h-3.5 w-3.5" />
        <span className="text-[11px] font-bold tracking-tight">VERIFIED AUTHENTIC</span>
        <CheckCircle2 className="h-3 w-3" />
      </a>
    );
  }

  return (
    <Card className={`overflow-hidden border-primary/20 shadow-xl ${isDark ? "bg-black/60" : "bg-white"}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  AuthiChain Certified
                </h4>
                <Badge variant="outline" className="text-[9px] uppercase tracking-tighter h-4 border-green-500/30 text-green-500 bg-green-500/5">
                  Authentic
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground line-clamp-1 mb-2">
                ID: {certificateNumber}
              </p>
              <div className="flex items-center gap-3 text-[10px]">
                <div className="flex items-center gap-1 text-primary font-medium">
                  <CheckCircle2 className="h-3 w-3" />
                  Blockchain Secured
                </div>
                <div className="flex items-center gap-1 text-primary font-medium">
                  <CheckCircle2 className="h-3 w-3" />
                  AI Verified
                </div>
              </div>
            </div>
          </div>
          <a 
            href={`https://authichain.com/verify/${certificateNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
