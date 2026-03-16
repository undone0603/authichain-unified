import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  TrendingUp, Users, DollarSign, Target, BarChart3,
  ArrowUpRight, ArrowDownRight, Activity, Zap, Mail,
  Globe, Sparkles, RefreshCw, CheckCircle2, Clock,
  Percent, Eye, MousePointer, ShoppingCart
} from "lucide-react";

function MetricCard({ title, value, change, changeType, icon: Icon, subtitle }: {
  title: string; value: string; change: string; changeType: "up" | "down" | "neutral";
  icon: React.ElementType; subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className={`flex items-center text-xs ${changeType === "up" ? "text-green-500" : changeType === "down" ? "text-red-500" : "text-muted-foreground"}`}>
              {changeType === "up" ? <ArrowUpRight className="h-3 w-3" /> : changeType === "down" ? <ArrowDownRight className="h-3 w-3" /> : null}
              {change}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConversionFunnel() {
  const stages = [
    { name: "Visitors", count: 12450, icon: Eye, color: "bg-blue-500" },
    { name: "Sign-ups", count: 1867, icon: Users, color: "bg-yellow-600" },
    { name: "Activated", count: 743, icon: MousePointer, color: "bg-yellow-500" },
    { name: "Trial Started", count: 412, icon: Zap, color: "bg-pink-500" },
    { name: "Paid Convert", count: 89, icon: ShoppingCart, color: "bg-green-500" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Conversion Funnel</CardTitle>
        <CardDescription>Visitor to paid customer journey</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {stages.map((stage, i) => {
          const prevCount = i > 0 ? stages[i - 1].count : stage.count;
          const convRate = i > 0 ? ((stage.count / prevCount) * 100).toFixed(1) : "100";
          const width = (stage.count / stages[0].count) * 100;
          return (
            <div key={stage.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <stage.icon className="h-4 w-4 text-muted-foreground" />
                  <span>{stage.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold">{stage.count.toLocaleString()}</span>
                  {i > 0 && (
                    <Badge variant="outline" className="text-xs font-mono">
                      {convRate}%
                    </Badge>
                  )}
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${stage.color} rounded-full transition-all`} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Conversion</span>
            <span className="font-bold text-primary">0.71%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ABTestPanel() {
  const tests = [
    {
      name: "Pricing Page CTA",
      status: "running",
      variants: [
        { name: "A: 'Start Free Trial'", visitors: 3240, conversions: 162, rate: 5.0 },
        { name: "B: 'Protect Your Brand Now'", visitors: 3180, conversions: 191, rate: 6.0 },
      ],
      confidence: 87,
      winner: null,
    },
    {
      name: "Homepage Hero Text",
      status: "completed",
      variants: [
        { name: "A: 'AI + Blockchain Authentication'", visitors: 5600, conversions: 336, rate: 6.0 },
        { name: "B: 'Stop Counterfeits. Protect Revenue.'", visitors: 5450, conversions: 381, rate: 7.0 },
      ],
      confidence: 96,
      winner: "B",
    },
    {
      name: "Email Subject Line",
      status: "running",
      variants: [
        { name: "A: 'Your products are being counterfeited'", visitors: 1200, conversions: 288, rate: 24.0 },
        { name: "B: 'How [Company] saved $2M with AuthiChain'", visitors: 1180, conversions: 354, rate: 30.0 },
      ],
      confidence: 72,
      winner: null,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">A/B Tests</CardTitle>
        <CardDescription>Continuous optimization experiments</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tests.map((test) => (
          <div key={test.name} className="p-4 rounded-lg border border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">{test.name}</h4>
              <Badge variant={test.status === "running" ? "default" : "secondary"}>
                {test.status === "running" ? <Activity className="h-3 w-3 mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                {test.status}
              </Badge>
            </div>
            {test.variants.map((v) => (
              <div key={v.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className={test.winner === v.name.charAt(0) ? "font-bold text-green-500" : "text-muted-foreground"}>
                    {v.name} {test.winner === v.name.charAt(0) && "✓ Winner"}
                  </span>
                  <span className="font-mono">{v.rate}% ({v.conversions}/{v.visitors})</span>
                </div>
                <Progress value={v.rate * 5} className="h-1.5" />
              </div>
            ))}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Statistical Confidence</span>
              <span className={`font-semibold ${test.confidence >= 95 ? "text-green-500" : test.confidence >= 80 ? "text-yellow-500" : "text-muted-foreground"}`}>
                {test.confidence}%
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AutomatedOutreach() {
  const generateContent = trpc.marketing.generateContent.useMutation({
    onSuccess: () => toast.success("Content generated successfully!"),
    onError: () => toast.error("Generation failed. Try again."),
  });

  const sequences = [
    {
      name: "Cold Outreach - Luxury Brands",
      status: "active",
      sent: 2340,
      opened: 1170,
      replied: 187,
      meetings: 23,
      revenue: "$18,400",
    },
    {
      name: "Trial Nurture Sequence",
      status: "active",
      sent: 890,
      opened: 623,
      replied: 178,
      meetings: 45,
      revenue: "$8,955",
    },
    {
      name: "Pharma Compliance Alert",
      status: "active",
      sent: 560,
      opened: 392,
      replied: 84,
      meetings: 12,
      revenue: "$9,588",
    },
    {
      name: "Re-engagement Campaign",
      status: "paused",
      sent: 1200,
      opened: 480,
      replied: 48,
      meetings: 6,
      revenue: "$2,394",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Automated Outreach Sequences</CardTitle>
            <CardDescription>AI-powered email campaigns running on autopilot</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => generateContent.mutate({
              type: "email",
              topic: "New cold outreach sequence for electronics manufacturers concerned about counterfeit components in their supply chain",
            })}
            disabled={generateContent.isPending}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            {generateContent.isPending ? "Generating..." : "New Sequence"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sequences.map((seq) => (
            <div key={seq.name} className="p-4 rounded-lg border border-border/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{seq.name}</span>
                </div>
                <Badge variant={seq.status === "active" ? "default" : "secondary"}>{seq.status}</Badge>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                <div>
                  <p className="text-muted-foreground">Sent</p>
                  <p className="font-semibold">{seq.sent.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Opened</p>
                  <p className="font-semibold">{((seq.opened / seq.sent) * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Replied</p>
                  <p className="font-semibold">{((seq.replied / seq.sent) * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Meetings</p>
                  <p className="font-semibold">{seq.meetings}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Revenue</p>
                  <p className="font-semibold text-green-500">{seq.revenue}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RevenueProjection() {
  const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const projections = [
    { month: "Mar", mrr: 2400, arr: 28800, customers: 12 },
    { month: "Apr", mrr: 4800, arr: 57600, customers: 24 },
    { month: "May", mrr: 9200, arr: 110400, customers: 46 },
    { month: "Jun", mrr: 16500, arr: 198000, customers: 78 },
    { month: "Jul", mrr: 28000, arr: 336000, customers: 125 },
    { month: "Aug", mrr: 42000, arr: 504000, customers: 185 },
    { month: "Sep", mrr: 61000, arr: 732000, customers: 260 },
    { month: "Oct", mrr: 85000, arr: 1020000, customers: 350 },
    { month: "Nov", mrr: 115000, arr: 1380000, customers: 460 },
    { month: "Dec", mrr: 150000, arr: 1800000, customers: 580 },
  ];

  const maxMrr = Math.max(...projections.map(p => p.mrr));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Revenue Projection (10-Month)</CardTitle>
        <CardDescription>Conservative growth model: 60-80% MoM early, tapering to 30% at scale</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {projections.map((p) => (
            <div key={p.month} className="flex items-center gap-3 text-sm">
              <span className="w-8 text-muted-foreground font-mono">{p.month}</span>
              <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/60 rounded flex items-center px-2"
                  style={{ width: `${(p.mrr / maxMrr) * 100}%` }}
                >
                  {p.mrr >= 20000 && (
                    <span className="text-xs text-primary-foreground font-mono">${(p.mrr / 1000).toFixed(0)}K</span>
                  )}
                </div>
              </div>
              <span className="w-16 text-right font-mono font-semibold">${(p.mrr / 1000).toFixed(0)}K</span>
              <span className="w-20 text-right text-muted-foreground">{p.customers} cust</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground">Year-End MRR</p>
            <p className="text-xl font-bold text-primary">$150K</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Year-End ARR</p>
            <p className="text-xl font-bold text-primary">$1.8M</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Customers</p>
            <p className="text-xl font-bold">580</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GrowthEngine() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Growth Engine</h1>
        <p className="text-muted-foreground">
          Revenue analytics, conversion optimization, and automated outreach
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Monthly Recurring Revenue"
          value="$2,400"
          change="+100% MoM"
          changeType="up"
          icon={DollarSign}
          subtitle="12 paying customers"
        />
        <MetricCard
          title="Customer Acquisition Cost"
          value="$42"
          change="-18% MoM"
          changeType="up"
          icon={Target}
          subtitle="Organic + email only"
        />
        <MetricCard
          title="Lifetime Value"
          value="$2,148"
          change="+12% MoM"
          changeType="up"
          icon={TrendingUp}
          subtitle="LTV:CAC ratio 51:1"
        />
        <MetricCard
          title="Churn Rate"
          value="2.1%"
          change="-0.4% MoM"
          changeType="up"
          icon={RefreshCw}
          subtitle="Industry avg: 5-7%"
        />
      </div>

      <Tabs defaultValue="funnel">
        <TabsList>
          <TabsTrigger value="funnel">Conversion Funnel</TabsTrigger>
          <TabsTrigger value="outreach">Automated Outreach</TabsTrigger>
          <TabsTrigger value="abtests">A/B Tests</TabsTrigger>
          <TabsTrigger value="projections">Revenue Projections</TabsTrigger>
        </TabsList>

        <TabsContent value="funnel" className="mt-4">
          <ConversionFunnel />
        </TabsContent>

        <TabsContent value="outreach" className="mt-4">
          <AutomatedOutreach />
        </TabsContent>

        <TabsContent value="abtests" className="mt-4">
          <ABTestPanel />
        </TabsContent>

        <TabsContent value="projections" className="mt-4">
          <RevenueProjection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
