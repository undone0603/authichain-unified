import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import {
  FileText, ExternalLink, DollarSign, Clock, CheckCircle2,
  AlertCircle, Copy, Download, Sparkles, Building, Globe,
  Shield, Target, Users, TrendingUp, Lightbulb
} from "lucide-react";

const GRANT_OPPORTUNITIES = [
  {
    id: "nsf-sbir",
    name: "NSF SBIR/STTR Phase I",
    agency: "National Science Foundation",
    amount: "$275,000",
    topic: "CA5 - Distributed Ledger / Cybersecurity & Authentication",
    deadline: "Rolling (Project Pitch)",
    status: "open",
    url: "https://seedfund.nsf.gov/topics/cybersecurity-authentication/",
    fit: 95,
    notes: "Zero equity taken. Perfect fit for AI + blockchain authentication. Sub-topic CA5 (Distributed Ledger) directly applies. Phase II up to $1M+.",
  },
  {
    id: "nsf-sbir-2",
    name: "NSF SBIR/STTR Phase II",
    agency: "National Science Foundation",
    amount: "$1,000,000+",
    topic: "CA5 - Distributed Ledger (Phase II follow-on)",
    deadline: "After Phase I award",
    status: "future",
    url: "https://seedfund.nsf.gov/",
    fit: 95,
    notes: "Follow-on to Phase I. Up to $1M+ with supplemental funding options. Requires Phase I completion.",
  },
  {
    id: "dhs-svip",
    name: "DHS SVIP - Preventing Forgery & Counterfeiting",
    agency: "Department of Homeland Security",
    amount: "Up to $800,000",
    topic: "Preventing Forgery and Counterfeiting of Certificates and Licenses",
    deadline: "Rolling",
    status: "open",
    url: "https://www.dhs.gov/science-and-technology/svip-application-process",
    fit: 98,
    notes: "Silicon Valley Innovation Program. 4-phase funding. Has funded 8+ blockchain companies (Transmute, Digital Bazaar, MATTR). Direct match for AuthiChain.",
  },
  {
    id: "digital-chamber",
    name: "Digital Chamber Microgrant",
    agency: "The Digital Chamber",
    amount: "$2,000",
    topic: "State-based blockchain organization advancement",
    deadline: "2026 cycle open",
    status: "open",
    url: "https://digitalchamber.org/",
    fit: 70,
    notes: "Small but fast. Good for visibility and networking in blockchain policy circles.",
  },
  {
    id: "ethereum-foundation",
    name: "Ethereum Foundation Grants",
    agency: "Ethereum Foundation",
    amount: "Varies ($5K-$500K)",
    topic: "Blockchain ecosystem development",
    deadline: "Rolling",
    status: "open",
    url: "https://ethereum.org/en/community/grants/",
    fit: 60,
    notes: "For projects building on Ethereum. AuthiChain NFT marketplace and blockchain verification qualify.",
  },
  {
    id: "nist-mep",
    name: "NIST MEP Supply Chain Grants",
    agency: "National Institute of Standards and Technology",
    amount: "Up to $300,000",
    topic: "Manufacturing supply chain technology",
    deadline: "Varies by state",
    status: "open",
    url: "https://www.nist.gov/mep",
    fit: 75,
    notes: "Manufacturing Extension Partnership. Supply chain verification and anti-counterfeiting for manufacturers.",
  },
];

const PARTNERSHIP_TARGETS = [
  {
    category: "Luxury & Fashion",
    targets: [
      { name: "Mid-tier luxury brands not in Aura Consortium", angle: "Offer Aura-level authentication at 1/10th the cost", priority: "high" },
      { name: "Shopify luxury merchants", angle: "Plug-in authentication for e-commerce stores", priority: "high" },
      { name: "Consignment platforms (TheRealReal, Vestiaire)", angle: "API integration for authentication at scale", priority: "medium" },
    ],
  },
  {
    category: "Pharmaceutical & Healthcare",
    targets: [
      { name: "Generic drug manufacturers", angle: "DSCSA compliance automation", priority: "high" },
      { name: "Hospital pharmacy networks", angle: "Counterfeit drug detection at point of care", priority: "medium" },
      { name: "Pharmaceutical distributors", angle: "Supply chain verification and audit trail", priority: "high" },
    ],
  },
  {
    category: "Technology Partners",
    targets: [
      { name: "QR code / NFC hardware manufacturers", angle: "Bundle AuthiChain software with physical tags", priority: "high" },
      { name: "ERP/SCM platforms (SAP, Oracle)", angle: "Integration partnership for authentication module", priority: "medium" },
      { name: "IoT device manufacturers", angle: "Embed authentication sensors in supply chain", priority: "medium" },
    ],
  },
  {
    category: "Channel Partners",
    targets: [
      { name: "Brand protection consultancies", angle: "White-label AuthiChain for their clients", priority: "high" },
      { name: "IP law firms", angle: "Referral partnership for anti-counterfeiting evidence", priority: "medium" },
      { name: "Insurance companies", angle: "Reduce counterfeiting claims with authentication data", priority: "low" },
    ],
  },
];

function GrantCard({ grant }: { grant: typeof GRANT_OPPORTUNITIES[0] }) {
  const generatePitch = trpc.marketing.generateContent.useMutation({
    onSuccess: (data) => {
      toast.success("Grant pitch generated! Check your email drafts.");
    },
  });

  return (
    <Card className={`border-border/50 ${grant.status === "open" ? "hover:border-primary/30" : "opacity-70"} transition-colors`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{grant.name}</CardTitle>
            <CardDescription>{grant.agency}</CardDescription>
          </div>
          <Badge variant={grant.status === "open" ? "default" : "secondary"}>
            {grant.status === "open" ? "Open" : "Future"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Amount:</span>
            <p className="font-semibold text-primary">{grant.amount}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Deadline:</span>
            <p className="font-semibold">{grant.deadline}</p>
          </div>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Topic:</span>
          <p className="text-sm">{grant.topic}</p>
        </div>
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Fit Score</span>
            <span className="font-semibold">{grant.fit}%</span>
          </div>
          <Progress value={grant.fit} className="h-2" />
        </div>
        <p className="text-xs text-muted-foreground">{grant.notes}</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm" variant="outline" asChild>
          <a href={grant.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3 mr-1" /> Apply
          </a>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => generatePitch.mutate({
            type: "email",
            topic: `Grant application pitch for ${grant.name} (${grant.agency}). Amount: ${grant.amount}. Topic: ${grant.topic}. AuthiChain is an AI + blockchain product authentication platform.`,
          })}
          disabled={generatePitch.isPending}
        >
          <Sparkles className="h-3 w-3 mr-1" /> Generate Pitch
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function GrantHub() {
  const totalPotentialFunding = GRANT_OPPORTUNITIES.reduce((sum, g) => {
    const amount = parseInt(g.amount.replace(/[^0-9]/g, "")) || 0;
    return sum + amount;
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Grants & Partnerships Hub</h1>
        <p className="text-muted-foreground">
          Funding opportunities and strategic partnership pipeline
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Potential</p>
              <p className="text-xl font-bold">${(totalPotentialFunding / 1000).toFixed(0)}K+</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Open Grants</p>
              <p className="text-xl font-bold">{GRANT_OPPORTUNITIES.filter(g => g.status === "open").length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Partner Targets</p>
              <p className="text-xl font-bold">{PARTNERSHIP_TARGETS.reduce((s, c) => s + c.targets.length, 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Target className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Fit Score</p>
              <p className="text-xl font-bold">
                {Math.round(GRANT_OPPORTUNITIES.reduce((s, g) => s + g.fit, 0) / GRANT_OPPORTUNITIES.length)}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="grants">
        <TabsList>
          <TabsTrigger value="grants">Grant Opportunities</TabsTrigger>
          <TabsTrigger value="partners">Partnership Pipeline</TabsTrigger>
          <TabsTrigger value="pitch">Pitch Materials</TabsTrigger>
        </TabsList>

        <TabsContent value="grants" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {GRANT_OPPORTUNITIES.map((grant) => (
              <GrantCard key={grant.id} grant={grant} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="partners" className="space-y-6 mt-4">
          {PARTNERSHIP_TARGETS.map((category) => (
            <Card key={category.category}>
              <CardHeader>
                <CardTitle className="text-lg">{category.category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {category.targets.map((target, i) => (
                    <div key={i} className="flex items-start justify-between p-3 rounded-lg border border-border/50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{target.name}</p>
                          <Badge
                            variant={target.priority === "high" ? "default" : target.priority === "medium" ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {target.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          <Lightbulb className="h-3 w-3 inline mr-1" />
                          {target.angle}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="pitch" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>AuthiChain Elevator Pitch</CardTitle>
              <CardDescription>Use this for grant applications and partner outreach</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 text-sm space-y-3">
                <p className="font-semibold">The Problem:</p>
                <p>Counterfeiting costs the global economy over $500 billion annually. Existing solutions address only one aspect — either detection OR tracking OR certification — forcing enterprises to cobble together multiple vendors.</p>
                
                <p className="font-semibold">The Solution:</p>
                <p>AuthiChain is the world's first unified AI + blockchain authentication platform. We combine real-time AI image analysis (99.7% accuracy), immutable blockchain verification, NFT-based certificates of authenticity, and automated supply chain tracking in a single SaaS platform.</p>
                
                <p className="font-semibold">Why One-of-a-Kind:</p>
                <p>No competitor offers AI-powered visual authentication AND blockchain verification AND an NFT marketplace AND automated business intelligence in one platform. AuthiChain eliminates the need for 4-5 separate vendor relationships.</p>
                
                <p className="font-semibold">Market Opportunity:</p>
                <p>The authentication and brand protection market is $4.1B (2026), growing at 12% CAGR. Blockchain authentication holds 53.5% market share. AuthiChain targets the intersection of AI ($200B) and blockchain authentication ($2.2B) markets.</p>
                
                <p className="font-semibold">Revenue Model:</p>
                <p>SaaS subscriptions ($49-$799/mo), usage-based authentication fees ($0.03-$0.49/auth), NFT minting fees ($2.50/NFT), white-label licensing ($2,499/mo), and physical product sales (holographic QR/NFC packs).</p>
                
                <p className="font-semibold">Traction:</p>
                <p>Production-ready platform with 14 integrated modules, AI authentication engine, NFT marketplace, and enterprise white-label capability. Targeting luxury goods, pharmaceuticals, agriculture, art, and electronics industries.</p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(
                    "AuthiChain is the world's first unified AI + blockchain authentication platform combining real-time AI image analysis, immutable blockchain verification, NFT-based certificates, and automated supply chain tracking. The $4.1B authentication market is growing at 12% CAGR, and no competitor offers our full-stack approach. We serve luxury, pharma, agriculture, art, and electronics with SaaS subscriptions from $49-$799/mo plus usage-based fees."
                  );
                  toast.success("Pitch copied to clipboard!");
                }}
              >
                <Copy className="h-4 w-4 mr-2" /> Copy Short Pitch
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key Differentiators for Grant Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: "Technical Innovation", desc: "First platform combining computer vision AI with blockchain consensus for product authentication. Novel approach to confidence scoring using multi-model ensemble analysis." },
                  { title: "Broader Impacts", desc: "Reduces $500B+ annual counterfeiting losses. Protects consumer safety (pharma, food). Enables small businesses to access enterprise-grade authentication." },
                  { title: "Commercial Potential", desc: "$4.1B addressable market growing 12% annually. Multiple revenue streams (SaaS, usage, NFTs, white-label). Path to $10M ARR within 3 years." },
                  { title: "Team & Execution", desc: "Production-ready platform with 14 integrated modules. AI engine operational. Blockchain verification live. Ready for customer deployment." },
                ].map((item, i) => (
                  <div key={i} className="p-4 rounded-lg border border-border/50">
                    <h3 className="font-semibold text-sm mb-2">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
