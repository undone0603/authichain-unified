import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SUBSCRIPTION_PLANS, type PlanKey } from "@shared/subscriptionPlans";

export default function Subscriptions() {
  const { data: current, isLoading } = trpc.subscription.current.useQuery();
  const { data: usage } = trpc.subscription.usage.useQuery();
  const subscribe = trpc.subscription.create.useMutation();
  const utils = trpc.useUtils();

  const handleSubscribe = async (plan: PlanKey) => {
    try {
      await subscribe.mutateAsync({ plan });
      toast.success(`Subscribed to ${SUBSCRIPTION_PLANS[plan].name} plan`);
      utils.subscription.current.invalidate();
      utils.subscription.usage.invalidate();
    } catch (e: any) { toast.error(e.message || "Subscription failed"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription Plans</h1>
        <p className="text-muted-foreground text-sm mt-1">Choose the plan that fits your authentication needs</p>
      </div>

      {current && (
        <Card className="border-primary/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <p className="text-lg font-bold capitalize">{current.plan}</p>
              </div>
              <Badge className="bg-green-500/10 text-green-400 border-green-500/20">{current.status}</Badge>
            </div>
            {usage && (
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Monthly Usage</span>
                  <span>{usage.used} / {usage.limit}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(usage.percentage, 100)}%` }} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-bold">${plan.monthlyPrice}</span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
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
                    disabled={isCurrent || subscribe.isPending}
                    onClick={() => handleSubscribe(key)}
                  >
                    {subscribe.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                    {isCurrent ? "Current Plan" : "Subscribe"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
