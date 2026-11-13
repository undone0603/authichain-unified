import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Loader2, ExternalLink, Receipt, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type FeeKind = "receipt" | "evidence";
type Pending = {
  kind: FeeKind;
  certificateNumber: string;
  authenticationId?: string;
};

const PENDING_KEY = "authichain.certFee.pending";

function readPending(): Pending | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}
function writePending(p: Pending | null) {
  try {
    if (p) sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable: the user can simply retry */
  }
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Certificates() {
  const utils = trpc.useUtils();
  const { data: certs, isLoading } = trpc.certificates.list.useQuery();
  const { data: pricing } = trpc.certificates.pricing.useQuery();

  const receiptCheckout = trpc.certificates.receiptCheckout.useMutation();
  const evidenceCheckout = trpc.certificates.evidenceCheckout.useMutation();
  const makePublic = trpc.certificates.makePublic.useMutation();

  const gated = pricing?.gateEnabled ?? false;

  async function recordReceipt(
    certificateNumber: string,
    authenticationId: string,
    sessionId?: string
  ) {
    const res = await makePublic.mutateAsync({
      authenticationId,
      certificateNumber,
      sessionId,
    });
    toast.success("Receipt recorded", { description: res.shareUrl });
  }

  async function downloadEvidence(
    certificateNumber: string,
    sessionId?: string
  ) {
    const bundle = await utils.certificates.evidence.fetch({
      certificateNumber,
      sessionId,
    });
    downloadJson(`evidence-${certificateNumber}.json`, bundle);
  }

  async function start(p: Pending) {
    try {
      if (!gated) {
        if (p.kind === "receipt") {
          return await recordReceipt(p.certificateNumber, p.authenticationId!);
        }
        return await downloadEvidence(p.certificateNumber);
      }
      writePending(p);
      const checkout =
        p.kind === "receipt"
          ? await receiptCheckout.mutateAsync({
              certificateNumber: p.certificateNumber,
              origin: window.location.origin,
            })
          : await evidenceCheckout.mutateAsync({
              certificateNumber: p.certificateNumber,
              origin: window.location.origin,
            });
      window.location.assign(checkout.url);
    } catch (e) {
      writePending(null);
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  // Returning from Stripe: finish whatever the user started, exactly once.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    const qs = new URLSearchParams(window.location.search);
    const sessionId = qs.get("session_id");
    if (qs.get("cancelled")) {
      writePending(null);
    }
    if (!sessionId || qs.get("success") !== "true") return;
    resumed.current = true;
    const pending = readPending();
    writePending(null);
    window.history.replaceState({}, "", window.location.pathname);
    if (!pending) {
      toast.error("Payment received, but the pending action was lost", {
        description: "Click the button again; you will not be charged twice.",
      });
      return;
    }
    (pending.kind === "receipt"
      ? recordReceipt(
          pending.certificateNumber,
          pending.authenticationId!,
          sessionId
        )
      : downloadEvidence(pending.certificateNumber, sessionId)
    ).catch(e =>
      toast.error(e instanceof Error ? e.message : "Could not complete action")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy =
    receiptCheckout.isPending ||
    evidenceCheckout.isPending ||
    makePublic.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Certificates</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Verification is always free. Recording a receipt and exporting
          evidence are paid
          {pricing?.gateEnabled
            ? ` (${dollars(pricing.receiptCents)} / ${dollars(pricing.evidenceCents)})`
            : ""}
          .
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : certs && certs.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certs.map((cert: any) => (
            <Card
              key={cert.id}
              className="hover:border-primary/30 transition-colors"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <Award className="h-5 w-5 text-primary" />
                  <Badge
                    variant="outline"
                    className={
                      cert.status === "valid"
                        ? "border-green-500/30 text-green-400"
                        : "border-yellow-500/30 text-yellow-400"
                    }
                  >
                    {cert.status}
                  </Badge>
                </div>
                <h3 className="font-semibold text-sm mb-1 truncate">
                  {cert.certificateNumber}
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Issued: {new Date(cert.issuedAt).toLocaleDateString()}
                  {cert.expiresAt && (
                    <>
                      {" "}
                      · Expires: {new Date(cert.expiresAt).toLocaleDateString()}
                    </>
                  )}
                </p>
                {cert.blockchainTxHash && (
                  <p className="text-xs text-muted-foreground truncate mb-3">
                    TX: {cert.blockchainTxHash}
                  </p>
                )}
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-transparent"
                    onClick={() =>
                      window.open(
                        `/certificate/${cert.verificationToken}`,
                        "_blank"
                      )
                    }
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" /> Verify (free)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-transparent"
                    disabled={busy || !cert.authenticationId}
                    onClick={() =>
                      start({
                        kind: "receipt",
                        certificateNumber: cert.certificateNumber,
                        authenticationId: cert.authenticationId,
                      })
                    }
                  >
                    <Receipt className="mr-2 h-3.5 w-3.5" /> Record receipt
                    {gated && pricing
                      ? ` · ${dollars(pricing.receiptCents)}`
                      : ""}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-transparent"
                    disabled={busy}
                    onClick={() =>
                      start({
                        kind: "evidence",
                        certificateNumber: cert.certificateNumber,
                      })
                    }
                  >
                    <FileDown className="mr-2 h-3.5 w-3.5" /> Evidence bundle
                    {gated && pricing
                      ? ` · ${dollars(pricing.evidenceCents)}`
                      : ""}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Award className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">No Certificates Yet</h3>
            <p className="text-sm text-muted-foreground">
              Certificates are issued after successful product authentication.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
