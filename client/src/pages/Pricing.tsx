import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Loader2, Shield, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { B2B_PLANS, QRON_PLANS, type B2BBrand } from "@shared/pricing";
import { useBrand } from "@/contexts/BrandContext";

// ─── B2B plan rendering ──────────────────────────────────────────────────────
// ... (rest of the file)

type Cluster = "b2b" | "qron";

function clusterFromHost(host: string): Cluster {
  return host.startsWith("qron.") || host === "qron.space" ? "qron" : "b2b";
}

function brandFromHost(host: string): B2BBrand | undefined {
  if (host.startsWith("strainchain.")) return "strainchain";
  if (host.startsWith("govchain.")) return "govchain";
  if (host.startsWith("authichain.") || host === "localhost" || host.startsWith("localhost:"))
    return "authichain";
  return undefined;
}

// ─── B2B plan rendering ──────────────────────────────────────────────────────

const B2B_DISPLAY = [
  {
    id: "starter" as const,
    icon: Shield,
    description: "Essential brand-protection authentication.",
    features: [
      `${B2B_PLANS.starter.quota.toLocaleString()} authentications/month`,
      "QR code generation",
      "Basic certificates",
      "Email support",
    ],
  },
  {
    id: "professional" as const,
    icon: Zap,
    description: "Advanced authentication for serious brands.",
    features: [
      `${B2B_PLANS.professional.quota.toLocaleString()} authentications/month`,
      "NFT certificate minting",
      "AI Autopilot engine",
      "Priority support",
    ],
    featured: true,
  },
  {
    id: "enterprise" as const,
    icon: Crown,
    description: "Full-scale enterprise authentication.",
    features: [
      `${B2B_PLANS.enterprise.quota.toLocaleString()} authentications/month`,
      "White-label solution",
      "Custom smart contracts",
      "Dedicated account manager",
    ],
  },
];

// ─── QRON plan rendering ─────────────────────────────────────────────────────

const QRON_DISPLAY = [
  {
    id: "launch_pack" as const,
    icon: Sparkles,
    priceLabel: `$${QRON_PLANS.launch_pack.oneTimeCents / 100}`,
    period: "one-time",
    description: "Launch your first 3 portals.",
    features: [
      `${QRON_PLANS.launch_pack.portals} QR portals`,
      "Editable destinations",
      "Basic analytics",
    ],
  },
  {
    id: "studio" as const,
    icon: Zap,
    priceLabel: `$${QRON_PLANS.studio.monthlyCents / 100}`,
    period: "/mo",
    description: "Generate up to 20 living QR portals per month.",
    features: [
      `${QRON_PLANS.studio.generationsPerMonth} generations/month`,
      "Editable destinations",
      "Scan analytics",
      "Saved templates",
    ],
    featured: true,
  },
  {
    id: "studio_pro" as const,
    icon: Crown,
    priceLabel: `$${QRON_PLANS.studio_pro.monthlyCents / 100}`,
    period: "/mo",
    description: "Unlimited generations + advanced analytics.",
    features: [
      "Unlimited generations",
      "Advanced analytics & A/B routing",
      "Brand library",
      "Priority support",
    ],
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Pricing() {
  const { brand } = useBrand();
  const [host, setHost] = useState<string>("");
  useEffect(() => setHost(window.location.host), []);

  const cluster = useMemo<Cluster>(() => clusterFromHost(host), [host]);
  const b2bBrand = useMemo<B2BBrand | undefined>(() => brandFromHost(host), [host]);

  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const checkout = trpc.subscriptions.checkout.useMutation();

  const handleSubscribe = async (planId: string, displayName: string) => {
    // QRON Launch Pack ($39 one-time) is not a recurring subscription;
    // it should route through services.checkout once a Stripe service-order
    // entry is wired. Until then, we surface a friendly toast.
    if (planId === "launch_pack") {
      toast.info(`${brand.displayName} Launch Pack is a one-time purchase — checkout coming soon.`);
      return;
    }
    setLoadingPlan(planId);
    try {
      const { checkoutUrl } = await checkout.mutateAsync({
        plan: planId as any,
        billing: "monthly",
        origin: window.location.origin,
        ...(cluster === "b2b" && b2bBrand ? { brand: b2bBrand } : {}),
      });
      toast.success(`Redirecting to ${displayName} checkout…`);
      window.location.href = checkoutUrl;
    } catch (error: any) {
      toast.error(`Checkout failed: ${error.message}`);
      setLoadingPlan(null);
    }
  };

  const isQron = cluster === "qron";
  const items = isQron ? QRON_DISPLAY : B2B_DISPLAY;

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">
          {brand.displayName} Pricing
        </h1>
        <p className="text-muted-foreground">
          {isQron
            ? "Living QR portals for small businesses, makers, and single-location brands."
            : brand.description}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {items.map((p) => {
          const PlanIcon = p.icon;
          const priceLabel = isQron
            ? (p as typeof QRON_DISPLAY[number]).priceLabel
            : `$${B2B_PLANS[p.id as keyof typeof B2B_PLANS].monthlyCents / 100}`;
          const period = isQron
            ? (p as typeof QRON_DISPLAY[number]).period
            : "/mo";
          const displayName = isQron
            ? QRON_PLANS[p.id as keyof typeof QRON_PLANS].name
            : B2B_PLANS[p.id as keyof typeof B2B_PLANS].name;
          const featured = (p as { featured?: boolean }).featured ?? false;

          return (
            <Card key={p.id} className={featured ? "border-primary" : ""}>
              <CardHeader>
                {featured && <Badge>Most Popular</Badge>}
                <CardTitle className="flex items-center gap-2">
                  <PlanIcon className="w-5 h-5" /> {displayName}
                </CardTitle>
                <CardDescription>{p.description}</CardDescription>
                <div className="text-3xl font-bold mt-2">
                  {priceLabel}
                  <span className="text-sm font-normal text-muted-foreground"> {period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-1 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => handleSubscribe(p.id, displayName)}
                  disabled={loadingPlan === p.id}
                >
                  {loadingPlan === p.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Subscribe"
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
