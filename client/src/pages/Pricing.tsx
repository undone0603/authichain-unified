import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Shield, Star, Crown, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

const PLANS = [
  {
    name: "StrainChain Basic",
    price: "$199",
    period: "/mo",
    description: "Essential cannabis compliance & provenance.",
    features: [
      "500 Product Verifications/mo",
      "Seed-to-Sale Storymode",
      "TrueMark Digital Seals",
      "Basic Analytics",
      "Email Support"
    ],
    stripeLink: "https://buy.stripe.com/14A4gz9brgbQdOG4ba1Nu0w",
    color: "green",
    icon: Shield
  },
  {
    name: "AuthiChain Professional",
    price: "$499",
    period: "/mo",
    description: "Advanced forensic utility for global brands.",
    features: [
      "2,500 Verifications/mo",
      "Magic Eye Forensic Analysis",
      "Full API Gateway Access",
      "AI AutoFlow Classification",
      "Priority 24h Support"
    ],
    stripeLink: "https://buy.stripe.com/8x28wP5Zf1gWcKC4ba1Nu0x",
    color: "yellow",
    icon: Zap,
    featured: true
  },
  {
    name: "Enterprise Sovereign",
    price: "$999",
    period: "/mo",
    description: "Institutional-grade truth infrastructure.",
    features: [
      "Unlimited Verifications",
      "BTC Ordinals Anchoring",
      "Custom Manufacturer Deals",
      "SLA Guarantee",
      "Dedicated CSM"
    ],
    stripeLink: "https://buy.stripe.com/aFaaEX9br4t8dOG8rq1Nu0y",
    color: "blue",
    icon: Crown
  }
];

export default function Pricing() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = (link: string, name: string) => {
    setLoading(name);
    toast.success(`Redirecting to ${name} checkout...`);
    window.location.href = link;
  };

  return (
    <div className="min-h-screen bg-[#050507] text-white py-24 px-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-yellow-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="container max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 mb-4 font-mono tracking-widest uppercase py-1 px-4">
            Revenue Tier Matrix
          </Badge>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter uppercase italic mb-6">
            Scale the <span className="text-yellow-500">Economy.</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg font-light">
            Choose the truth protocol that fits your scale. All plans include $QRON agent rewards and immutable ledger logging.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <Card 
              key={plan.name} 
              className={`relative bg-white/5 border-white/5 overflow-hidden flex flex-col group transition-all duration-500 hover:scale-[1.02] ${
                plan.featured ? 'border-yellow-500/50 shadow-2xl shadow-yellow-500/10' : ''
              }`}
            >
              {plan.featured && (
                <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-tighter">
                  Most Popular
                </div>
              )}

              <CardHeader className="pt-8 px-8">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-${plan.color}-500/10 border border-${plan.color}-500/20`}>
                  <plan.icon className={`w-6 h-6 text-${plan.color === 'yellow' ? 'yellow-500' : plan.color === 'green' ? 'green-500' : 'blue-500'}`} />
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight italic uppercase">{plan.name}</CardTitle>
                <CardDescription className="text-slate-500">{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="px-8 flex-grow">
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-5xl font-bold tracking-tighter">{plan.price}</span>
                  <span className="text-slate-500 font-mono text-sm uppercase">{plan.period}</span>
                </div>

                <div className="space-y-4">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-3 text-sm text-slate-300">
                      <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                         <Check className="w-3 h-3 text-yellow-500" strokeWidth={3} />
                      </div>
                      {feature}
                    </div>
                  ))}
                </div>
              </CardContent>

              <CardFooter className="p-8">
                <Button 
                  onClick={() => handleSubscribe(plan.stripeLink, plan.name)}
                  disabled={loading === plan.name}
                  className={`w-full h-14 text-lg font-bold uppercase italic rounded-xl transition-all ${
                    plan.featured 
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-black shadow-lg shadow-yellow-500/20' 
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                  }`}
                >
                  {loading === plan.name ? <Loader2 className="w-5 h-5 animate-spin" /> : "Deploy Protocol"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-20 p-12 rounded-3xl bg-white/5 border border-white/5 text-center">
          <h3 className="text-2xl font-bold mb-4 uppercase italic">Custom QRON Art QR Codes</h3>
          <p className="text-slate-400 mb-8 max-w-xl mx-auto">Transform your brand engagement with cinematic scannable art. 100% scan guarantee.</p>
          <div className="flex flex-wrap justify-center gap-4">
             <Button asChild variant="outline" className="border-white/10 text-white font-bold h-12 px-8">
               <a href="https://buy.stripe.com/6oU3cvafv1gW25YcHG1Nu0z">Single Design — $49</a>
             </Button>
             <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold h-12 px-8 shadow-lg shadow-yellow-500/20">
               <a href="https://buy.stripe.com/aFabJ1cnD9Ns25Y7nm1Nu0A">Brand Pack (5) — $199</a>
             </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
