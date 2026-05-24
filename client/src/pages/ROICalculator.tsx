import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  ShieldCheck, 
  Clock, 
  DollarSign, 
  ArrowRight, 
  CheckCircle2, 
  FileCheck,
  Zap
} from "lucide-react";
import { toast } from "sonner";

export default function ROICalculator() {
  const [form, setForm] = useState({
    numProducts: 10000,
    complianceHoursPerMonth: 320,
    hourlyRate: 125,
    existingTechCosts: 45000,
    industry: "medtech",
    userEmail: ""
  });

  const calculateRoi = trpc.sales.calculateRoi.useMutation({
    onSuccess: (data) => {
      toast.success("ROI Analysis Generated");
      setResults(data);
    },
    onError: (e) => toast.error(e.message)
  });

  const [results, setResults] = useState<any>(null);

  const handleCalculate = async () => {
    if (!form.userEmail) {
      toast.error("Please provide your business email for the full report.");
      return;
    }
    calculateRoi.mutate(form);
  };

  return (
    <div className="min-h-screen protocol-bg py-24">
      <div className="container max-w-5xl">
        <div className="text-center mb-16">
          <Badge className="protocol-badge mb-4 mx-auto">Financial Engineering Layer</Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 gradient-text">
            Quantify Your Trust Advantage
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Calculate the exact ROI of deploying the AuthiChain Protocol across your supply chain.
            Average Year 1 savings: <span className="text-primary font-bold">$142,000+</span>.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Inputs */}
          <Card className="lg:col-span-5 glass-card border-primary/20">
            <CardHeader>
              <CardTitle className="text-xl">Operational Parameters</CardTitle>
              <CardDescription>Input your current supply chain and compliance metrics.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Industry Segment</Label>
                <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medtech">Medical Device (FDA/ISO Compliance)</SelectItem>
                    <SelectItem value="timepieces">Luxury Timepieces (Independent Brands)</SelectItem>
                    <SelectItem value="pharma">Pharmaceutical (FDA DSCSA)</SelectItem>
                    <SelectItem value="luxury">Luxury Goods & Fashion</SelectItem>
                    <SelectItem value="cannabis">Cannabis (METRC / Seed-to-Sale)</SelectItem>
                    <SelectItem value="electronics">Industrial Electronics</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Number of Products / SKUs</Label>
                <Input 
                  type="number" 
                  value={form.numProducts} 
                  onChange={(e) => setForm({ ...form, numProducts: parseInt(e.target.value) })}
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label>Manual Compliance Hours / Mo</Label>
                <Input 
                  type="number" 
                  value={form.complianceHoursPerMonth} 
                  onChange={(e) => setForm({ ...form, complianceHoursPerMonth: parseInt(e.target.value) })}
                  className="bg-background/50"
                />
                <p className="text-[10px] text-muted-foreground italic">Time spent on audits, documentation, and verification.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Avg. Hourly Rate ($)</Label>
                  <Input 
                    type="number" 
                    value={form.hourlyRate} 
                    onChange={(e) => setForm({ ...form, hourlyRate: parseInt(e.target.value) })}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Current Tech Spend ($)</Label>
                  <Input 
                    type="number" 
                    value={form.existingTechCosts} 
                    onChange={(e) => setForm({ ...form, existingTechCosts: parseInt(e.target.value) })}
                    className="bg-background/50"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-border/50">
                <div className="space-y-2 mb-4">
                  <Label>Business Email (for Full Report)</Label>
                  <Input 
                    placeholder="you@company.com"
                    type="email" 
                    value={form.userEmail} 
                    onChange={(e) => setForm({ ...form, userEmail: e.target.value })}
                    className="bg-primary/5 border-primary/30"
                  />
                </div>
                <Button className="w-full h-12 text-md font-bold" onClick={handleCalculate} disabled={calculateRoi.isPending}>
                  {calculateRoi.isPending ? "Analyzing..." : "Generate ROI Analysis"} <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="lg:col-span-7 space-y-6">
            {!results ? (
              <div className="h-full min-h-[400px] border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center p-12 bg-muted/10">
                <TrendingUp className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground/50">Analysis Pending</h3>
                <p className="text-muted-foreground/40 max-w-xs mt-2">Complete the form to see your projected savings and AuthiChain pricing tier.</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Main Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="pt-6">
                      <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Year 1 Savings</p>
                      <p className="text-3xl font-bold text-white">${results.year1Savings.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-yellow-500/5 border-yellow-500/20">
                    <CardContent className="pt-6">
                      <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-1">Payback Period</p>
                      <p className="text-3xl font-bold text-white">{results.paybackMonths} Months</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-border/50 bg-black/40 backdrop-blur-xl">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle>AuthiChain {results.tierName} Tier</CardTitle>
                      <Badge variant="outline" className="border-primary/30 text-primary">Protocol Price</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-4">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Implementation (One-time)</span>
                        <span>${results.pricing.implementationFee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Annual Protocol Fee</span>
                        <span>${results.pricing.subscriptionFee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm text-primary font-medium italic">
                        <span>Early Signing Incentive (10%)</span>
                        <span>-${results.pricing.discount.toLocaleString()}</span>
                      </div>
                      <div className="pt-3 border-t border-border/50 flex justify-between font-bold text-lg">
                        <span>Total Year 1 Investment</span>
                        <span className="text-primary">${results.pricing.total.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="space-y-4 pt-6 border-t border-border/50">
                      <h4 className="text-xs font-bold uppercase tracking-widest">Protocol Impact</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <span className="text-sm">80% Manual Labor Reduction</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <span className="text-sm">FIPS 140-2 Compliance</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <span className="text-sm">Real-time Fraud Alerts</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <span className="text-sm">W3C Verifiable Credentials</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4">
                      <Button className="w-full h-14 bg-gradient-to-r from-primary to-yellow-600 hover:opacity-90 font-extrabold text-black uppercase tracking-tighter" onClick={() => window.location.href='/pricing'}>
                         Initialize Protocol Onboarding
                      </Button>
                      <p className="text-[10px] text-center text-muted-foreground mt-3 uppercase tracking-widest font-mono">
                        Cryptographic MSA generated upon acceptance
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* 3-Year Forecast */}
                <div className="rounded-2xl p-6 border border-border/50 bg-gradient-to-br from-muted/20 to-transparent">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <h4 className="text-sm font-bold uppercase tracking-widest">3-Year Strategic Forecast</h4>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-white">${results.threeYearSavings.toLocaleString()}</span>
                    <span className="text-muted-foreground text-sm uppercase">Total Cumulative Savings</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    Based on standard industry CAGR and compliance escalation. AuthiChain delivers compounding value by transforming regulatory burden into an automated immutable asset.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
