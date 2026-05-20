/**
 * WalletConnect - Provides wallet connection UI using Thirdweb's ConnectButton.
 * Falls back gracefully if Thirdweb is not configured.
 */
import { ConnectButton } from "thirdweb/react";
import { thirdwebClient, defaultChain } from "@/lib/thirdweb";
import { Badge } from "@/components/ui/badge";
import { Wallet, AlertCircle } from "lucide-react";

interface WalletConnectProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function WalletConnect({ size = "md", className }: WalletConnectProps) {
  if (!thirdwebClient) {
    return (
      <Badge variant="outline" className={`text-yellow-500 border-yellow-500/30 ${className || ""}`}>
        <AlertCircle className="h-3 w-3 mr-1" />
        Wallet not configured
      </Badge>
    );
  }

  return (
    <div className={className}>
      <ConnectButton
        client={thirdwebClient}
        chain={defaultChain}
        connectButton={{
          label: size === "sm" ? "Connect" : "Connect Wallet",
          style: {
            backgroundColor: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            borderRadius: "0.5rem",
            fontSize: size === "sm" ? "0.75rem" : size === "lg" ? "1rem" : "0.875rem",
            padding: size === "sm" ? "0.25rem 0.75rem" : size === "lg" ? "0.75rem 1.5rem" : "0.5rem 1rem",
            fontWeight: "600",
          },
        }}
        detailsButton={{
          style: {
            backgroundColor: "hsl(var(--muted))",
            color: "hsl(var(--foreground))",
            borderRadius: "0.5rem",
            border: "1px solid hsl(var(--border))",
          },
        }}
      />
    </div>
  );
}

export function BlockchainStatusBadge({ connected, chain }: { connected: boolean; chain?: string }) {
  return (
    <Badge variant={connected ? "default" : "secondary"} className="gap-1">
      <Wallet className="h-3 w-3" />
      {connected ? chain || "Connected" : "Not Connected"}
    </Badge>
  );
}
