import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CreditCard, Loader2, ExternalLink, Receipt, XCircle } from "lucide-react";
import { toast } from "sonner";
import { SUBSCRIPTION_PLANS, type PlanKey } from "@shared/subscriptionPlans";
import { useState, useEffect } from "react";

export default function Subscriptions() {
  const { data: current, isLoading } = trpc.subscription.current.useQuery(undefined, { retry: false });
  const { data: usage } = trpc.subscription.usage.useQuery();
  const { data: paymentHistory } = trpc.subscription.paymentHistory.useQuery();
  const checkout = trpc.subscription.checkout.useMutation();
  const cancelSub = trpc.subscription.cancel.useMutation();
  const utils = trpc.useUtils();
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  // Check for success/cancel URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast.success("Subscription activated! Welcome to AuthiChain.");
      utils.subscription.current.invalidate();
      utils.subscription.usage.invalidate();
      window.history.replaceState({}, "", "/subscriptions");
    }
    if (params.get("cancelled") === "true") {
      toast.info("Checkout cancelled. You can subscribe anytime.");
      window.history.replaceState({}, "", "/subscriptions");
    }
  }, []);

  const handleCheckout = async (plan: "starter" | "professional" | "enterprise" | "medtech") => {
    // MedTech is a $150K high-ticket tier handled via sales, not self-serve checkout.
    if (plan === "medtech") {
      toast.info("MedTech is a custom enterprise tier — our team will reach out to you.");
      window.location.href = "mailto:sales@authichain.com?subject=MedTech%20Enterprise%20Inquiry";
      return;
    }
    try {
      const result = await checkout.mutateAsync({
        plan: plan as any,
        billing,
        origin: window.location.origin,
      });
      toast.info("Redirecting to Stripe checkout...");
      window.open(result.checkoutUrl, "_blank");
    } catch (e: any) {
      toast.error(e.message || "Failed to create checkout session");
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? It will remain active until the end of your billing period.")) return;
    try {
      await cancelSub.mutateAsync();
      toast.success("Subscription will cancel at end of billing period");
      utils.subscription.current.invalidate();
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel subscription");
    }
  };

  const getPrice = (plan: typeof SUBSCRIPTION_PLANS[PlanKey]) => {
    return billing === "annual" ? plan.annualPrice : plan.monthlyPrice;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription Plans</h1>
        <p className="text-muted-foreground text-sm mt-1">Choose the plan that fits your authentication needs. Powered by Stripe.</p>
      </div>

      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm ${billing === "monthly" ? "text-foreground font-medium" : "text-muted-foreground"}`}>Monthly</span>
        <button
          onClick={() => setBilling(b => b === "monthly" ? "annual" : "monthly")}
          className={`relative w-12 h-6 rounded-full transition-colors ${billing === "annual" ? "bg-primary" : "bg-secondary"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${billing === "annual" ? "translate-x-6" : "translate-x-0.5"}`} />
        </button>
        <span className={`text-sm ${billing === "annual" ? "text-foreground font-medium" : "text-muted-foreground"}`}>
          Annual <Badge variant="outline" className="ml-1 text-xs text-green-400 border-green-500/30">Save 20%</Badge>
        </span>
      </div>

      {/* Current Plan Status */}
      {current && (
        <Card className="border-primary/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <p className="text-lg font-bold capitalize">{current.plan}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500/10 text-green-400 border-green-500/20">{current.status}</Badge>
                {current.stripeSubscriptionId && (
                  <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelSub.isPending}>
                    {cancelSub.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    Cancel
                  </Button>
                )}
              </div>
            </div>
            {usage && (
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Monthly Usage</span>
                  <span>{usage.used} / {usage.limit}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(usage.percentage, 100)}%` }} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan Cards */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {(Object.entries(SUBSCRIPTION_PLANS) as [PlanKey, typeof SUBSCRIPTION_PLANS[PlanKey]][]).map(([key, plan]) => {
            const isCurrent = current?.plan === key;
            return (
              <Card key={key} className={`${plan.highlighted ? "border-primary/50 glow-green" : ""} ${isCurrent ? "border-primary" : ""}`}>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-1">{plan.name}</h3>
                  {isCurrent && <Badge className="mb-3 bg-primary/10 text-primary border-primary/20">Current Plan</Badge>}
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold">${getPrice(plan)}</span>
                    <span className="text-muted-foreground text-sm">/{billing === "annual" ? "yr" : "mo"}</span>
                  </div>
                  {billing === "annual" && (
                    <p className="text-xs text-green-400 mb-4">${Math.round(plan.annualPrice / 12)}/mo billed annually</p>
                  )}
                  {billing === "monthly" && <div className="mb-4" />}
                  <ul className="space-y-2.5 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    disabled={isCurrent || checkout.isPending}
                    onClick={() => handleCheckout(key)}
                  >
                    {checkout.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                    {isCurrent ? "Current Plan" : "Subscribe with Stripe"}
                    {checkout.isPending && " ...creating session"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Payment History */}
      {paymentHistory && (paymentHistory.payments.length > 0 || paymentHistory.invoices.length > 0) && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Payment History
          </h2>

          {paymentHistory.invoices.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-muted-foreground font-medium">Invoice</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Amount</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Date</th>
                      <th className="text-right p-3 text-muted-foreground font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistory.invoices.map((inv: any) => (
                      <tr key={inv.id} className="border-b border-border/50 last:border-0">
                        <td className="p-3 font-mono text-xs">{inv.number || inv.id.slice(0, 16)}</td>
                        <td className="p-3">${(inv.amount / 100).toFixed(2)} {inv.currency?.toUpperCase()}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={inv.status === "paid" ? "text-green-400 border-green-500/30" : "text-yellow-400 border-yellow-500/30"}>
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{new Date(inv.created * 1000).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          {inv.hostedInvoiceUrl && (
                            <Button variant="ghost" size="sm" onClick={() => window.open(inv.hostedInvoiceUrl, "_blank")}>
                              <ExternalLink className="h-3 w-3 mr-1" /> View
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Test Card Info */}
      <Card className="border-dashed border-muted-foreground/20">
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Test payments with card: <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">4242 4242 4242 4242</code> | Any future date | Any CVC
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
