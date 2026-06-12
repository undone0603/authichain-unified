import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { SUBSCRIPTION_PLANS, ADDON_PRICING, INDUSTRY_SOLUTIONS, LICENSING_TIERS } from "@shared/subscriptionPlans";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import {
  Shield, Check, ArrowRight, Calculator, Zap, Building2,
  Pill, Leaf, Palette, Cannabis, Cpu, ChevronDown, Star,
  TrendingUp, DollarSign, Lock, Globe, Users
} from "lucide-react";

const industryIcons: Record<string, React.ReactNode> = {
  luxury: <Building2 className="h-6 w-6" />,
  pharmaceutical: <Pill className="h-6 w-6" />,
  agriculture: <Leaf className="h-6 w-6" />,
  art: <Palette className="h-6 w-6" />,
  cannabis: <Cannabis className="h-6 w-6" />,
  electronics: <Cpu className="h-6 w-6" />,
};

function ROICalculator() {
  const [productsPerMonth, setProductsPerMonth] = useState(1000);
  const [avgProductValue, setAvgProductValue] = useState(150);
  const [counterfeitRate, setCounterfeitRate] = useState(5);
  const [industry, setIndustry] = useState("luxury");

  const roi = useMemo(() => {
    const monthlyRevenueLost = productsPerMonth * avgProductValue * (counterfeitRate / 100);
    const annualRevenueLost = monthlyRevenueLost * 12;
    const authiChainCost = productsPerMonth <= 100 ? 49 : productsPerMonth <= 2500 ? 199 : 799;
    const annualCost = authiChainCost * 12;
    const revenueRecovered = annualRevenueLost * 0.85; // 85% recovery rate
    const netBenefit = revenueRecovered - annualCost;
    const roiPercent = annualCost > 0 ? ((netBenefit / annualCost) * 100) : 0;
    return {
      monthlyRevenueLost,
      annualRevenueLost,
      annualCost,
      revenueRecovered,
      netBenefit,
      roiPercent,
      recommendedPlan: productsPerMonth <= 100 ? "Starter" : productsPerMonth <= 2500 ? "Professional" : "Enterprise",
    };
  }, [productsPerMonth, avgProductValue, counterfeitRate]);

  return (
    <Card className="border-primary/20 bg-card/50 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <CardTitle>ROI Calculator</CardTitle>
        </div>
        <CardDescription>See how much AuthiChain saves your business</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Products Authenticated / Month</Label>
            <Input
              type="number"
              value={productsPerMonth}
              onChange={(e) => setProductsPerMonth(Number(e.target.value) || 0)}
              min={1}
            />
          </div>
          <div className="space-y-2">
            <Label>Average Product Value ($)</Label>
            <Input
              type="number"
              value={avgProductValue}
              onChange={(e) => setAvgProductValue(Number(e.target.value) || 0)}
              min={1}
            />
          </div>
          <div className="space-y-2">
            <Label>Estimated Counterfeit Rate (%)</Label>
            <Input
              type="number"
              value={counterfeitRate}
              onChange={(e) => setCounterfeitRate(Number(e.target.value) || 0)}
              min={0}
              max={100}
            />
          </div>
          <div className="space-y-2">
            <Label>Industry</Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INDUSTRY_SOLUTIONS).map(([key, sol]) => (
                  <SelectItem key={key} value={key}>{sol.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 rounded-lg bg-destructive/10">
            <p className="text-sm text-muted-foreground">Annual Revenue Lost</p>
            <p className="text-2xl font-bold text-destructive">${roi.annualRevenueLost.toLocaleString()}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-primary/10">
            <p className="text-sm text-muted-foreground">Revenue Recovered</p>
            <p className="text-2xl font-bold text-primary">${roi.revenueRecovered.toLocaleString()}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">AuthiChain Cost</p>
            <p className="text-2xl font-bold">${roi.annualCost.toLocaleString()}/yr</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-green-500/10">
            <p className="text-sm text-muted-foreground">ROI</p>
            <p className="text-2xl font-bold text-green-500">{roi.roiPercent.toFixed(0)}%</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-lg border border-primary/30 bg-primary/5">
          <div>
            <p className="font-semibold">Recommended Plan: {roi.recommendedPlan}</p>
            <p className="text-sm text-muted-foreground">Net annual benefit: ${roi.netBenefit.toLocaleString()}</p>
          </div>
          <Button>
            Get Started <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LeadCaptureForm() {
  const { isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    industry: "luxury",
    productsPerMonth: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const createLead = trpc.marketing.generateContent.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Thank you! Our team will contact you within 24 hours.");
    },
    onError: () => {
      toast.error("Something went wrong. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.companyName) {
      toast.error("Please fill in company name and email.");
      return;
    }
    createLead.mutate({
      type: "email",
      topic: `Enterprise lead: ${formData.companyName} - ${formData.contactName} (${formData.email}) - Industry: ${formData.industry} - Products/mo: ${formData.productsPerMonth}`,
    });
  };

  if (submitted) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="p-8 text-center">
          <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Request Received</h3>
          <p className="text-muted-foreground">
            Our enterprise team will reach out within 24 hours to schedule your personalized demo and compliance assessment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle>Schedule a Compliance Assessment</CardTitle>
        <CardDescription>
          Get a personalized demo and learn how AuthiChain protects your brand
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="Acme Corp"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Name</Label>
              <Input
                value={formData.contactName}
                onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-2">
              <Label>Business Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="jane@acme.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Select value={formData.industry} onValueChange={(v) => setFormData(prev => ({ ...prev, industry: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INDUSTRY_SOLUTIONS).map(([key, sol]) => (
                    <SelectItem key={key} value={key}>{sol.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>How many products do you authenticate monthly?</Label>
            <Input
              value={formData.productsPerMonth}
              onChange={(e) => setFormData(prev => ({ ...prev, productsPerMonth: e.target.value }))}
              placeholder="e.g., 5,000"
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={createLead.isPending}>
            {createLead.isPending ? "Submitting..." : "Schedule Compliance Assessment"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            No commitment required. We'll never share your information.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">AuthiChain</span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-muted-foreground hover:text-foreground">Home</a>
            {isAuthenticated ? (
              <Button asChild size="sm"><a href="/dashboard">Dashboard</a></Button>
            ) : (
              <Button asChild size="sm"><a href={getLoginUrl()}>Get Started</a></Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 text-center">
        <div className="container max-w-4xl">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30">
            <Zap className="h-3 w-3 mr-1" /> The Only AI + Blockchain Authentication Platform
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            One Platform. Complete Protection.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            AuthiChain is the world's first platform combining AI-powered image analysis, 
            blockchain verification, NFT certificates, and automated business intelligence 
            in a single solution. No other service offers this.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <span className={!annual ? "font-semibold" : "text-muted-foreground"}>Monthly</span>
            <Switch checked={annual} onCheckedChange={setAnnual} />
            <span className={annual ? "font-semibold" : "text-muted-foreground"}>
              Annual <Badge variant="secondary" className="ml-1">Save 20%</Badge>
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => {
              const price = annual ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice;
              return (
                <Card
                  key={key}
                  className={`relative ${plan.highlighted ? "border-primary shadow-lg shadow-primary/10 scale-105" : "border-border/50"}`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">{plan.badge}</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="mt-4">
                      <span className="text-4xl font-bold">${price}</span>
                      <span className="text-muted-foreground">/mo</span>
                    </div>
                    {annual && (
                      <p className="text-sm text-muted-foreground">
                        ${plan.annualPrice}/year (billed annually)
                      </p>
                    )}
                    <p className="text-xs text-primary mt-1">
                      ${plan.perAuthCost}/authentication
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-2">
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? "default" : "outline"}
                      asChild
                    >
                      <a href={(plan as any).paymentLink} target="_blank" rel="noopener noreferrer">
                        {key === "enterprise" ? "Buy Enterprise" : "Buy Now"} <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                    {isAuthenticated && (
                      <Button className="w-full" variant="ghost" size="sm" asChild>
                        <a href="/subscriptions">Manage Subscription</a>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Licensing & White-Label */}
      <section className="py-16 bg-muted/20">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <Badge variant="outline" className="mb-3 text-primary border-primary/30">
              <Lock className="h-3 w-3 mr-1" /> License the Truth Layer
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Licensing & White-Label</h2>
            <p className="text-muted-foreground">
              Ship verifiable authenticity under your own brand. One-time setup, then monthly —
              start instantly, no sales call required.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {LICENSING_TIERS.map((tier) => (
              <Card
                key={tier.key}
                className={`relative ${tier.highlighted ? "border-primary shadow-lg shadow-primary/10 scale-105" : "border-border/50"}`}
              >
                {tier.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground whitespace-nowrap">{tier.badge}</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">${tier.setupPrice.toLocaleString()}</span>
                    <span className="text-muted-foreground"> setup</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    then ${tier.monthlyPrice.toLocaleString()}/mo
                  </p>
                  <CardDescription className="mt-2">{tier.idealFor}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <Button className="w-full" variant={tier.highlighted ? "default" : "outline"} asChild>
                    <a href={tier.setupLink} target="_blank" rel="noopener noreferrer">
                      Pay setup fee <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                  <Button className="w-full" variant="ghost" size="sm" asChild>
                    <a href={tier.monthlyLink} target="_blank" rel="noopener noreferrer">
                      Start ${tier.monthlyPrice.toLocaleString()}/mo subscription
                    </a>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Add-ons */}
      <section className="py-16 bg-muted/30">
        <div className="container max-w-5xl">
          <h2 className="text-2xl font-bold text-center mb-8">Add-On Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(ADDON_PRICING).map(([key, addon]) => (
              <Card key={key} className="border-border/50">
                <CardContent className="p-4">
                  <h3 className="font-semibold">{addon.name}</h3>
                  <p className="text-2xl font-bold text-primary mt-1">
                    ${addon.price.toLocaleString()}
                    <span className="text-sm font-normal text-muted-foreground ml-1">{addon.unit}</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{addon.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Industry Solutions */}
      <section className="py-16">
        <div className="container max-w-5xl">
          <h2 className="text-2xl font-bold text-center mb-2">Industry Solutions</h2>
          <p className="text-center text-muted-foreground mb-8">
            Tailored authentication for your specific compliance requirements
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(INDUSTRY_SOLUTIONS).map(([key, sol]) => (
              <Card key={key} className="border-border/50 hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      {industryIcons[key]}
                    </div>
                    <div>
                      <h3 className="font-semibold">{sol.name}</h3>
                      <p className="text-xs text-muted-foreground">From ${sol.startingPrice}/mo</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{sol.tagline}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="py-16 bg-muted/30">
        <div className="container max-w-4xl">
          <h2 className="text-2xl font-bold text-center mb-2">Calculate Your ROI</h2>
          <p className="text-center text-muted-foreground mb-8">
            See how much counterfeiting costs your business and how AuthiChain pays for itself
          </p>
          <ROICalculator />
        </div>
      </section>

      {/* Why One-of-a-Kind */}
      <section className="py-16">
        <div className="container max-w-5xl">
          <h2 className="text-2xl font-bold text-center mb-2">Why AuthiChain Is One-of-a-Kind</h2>
          <p className="text-center text-muted-foreground mb-8">
            No other platform combines all of these capabilities
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <Shield className="h-6 w-6" />, title: "AI + Blockchain", desc: "Dual-layer verification no competitor offers" },
              { icon: <TrendingUp className="h-6 w-6" />, title: "Autopilot AI", desc: "Automated lead gen, outreach, and qualification" },
              { icon: <DollarSign className="h-6 w-6" />, title: "NFT Marketplace", desc: "Monetize authentication with tradeable certificates" },
              { icon: <Globe className="h-6 w-6" />, title: "White-Label", desc: "Resell as your own brand to enterprise clients" },
            ].map((item, i) => (
              <div key={i} className="text-center p-6">
                <div className="inline-flex p-3 rounded-xl bg-primary/10 text-primary mb-3">
                  {item.icon}
                </div>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Lead Capture */}
      <section className="py-16 bg-muted/30">
        <div className="container max-w-2xl">
          <h2 className="text-2xl font-bold text-center mb-2">Enterprise & Custom Solutions</h2>
          <p className="text-center text-muted-foreground mb-8">
            Need a custom deployment, on-premise solution, or volume pricing? Let's talk.
          </p>
          <LeadCaptureForm />
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16">
        <div className="container max-w-4xl text-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <p className="text-3xl font-bold text-primary">$4.1B</p>
              <p className="text-sm text-muted-foreground">Market Size (2026)</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">53.5%</p>
              <p className="text-sm text-muted-foreground">Blockchain Auth Share</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">12%</p>
              <p className="text-sm text-muted-foreground">Annual Market Growth</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">85%</p>
              <p className="text-sm text-muted-foreground">Revenue Recovery Rate</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 text-center bg-gradient-to-b from-background to-primary/5">
        <div className="container max-w-2xl">
          <h2 className="text-3xl font-bold mb-4">
            Stop Losing Revenue to Counterfeits
          </h2>
          <p className="text-muted-foreground mb-8">
            Join the authentication revolution. Start protecting your products today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <a href={isAuthenticated ? "/subscriptions" : getLoginUrl()}>
                Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#roi-calculator">Calculate Your ROI</a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
