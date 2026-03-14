import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Shield, Film, Bot, Globe, BookOpen, Building2, ArrowLeft, Check, Star, Zap, Clock, ArrowRight, Loader2 } from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  Shield, Film, Bot, Globe, BookOpen, Building2,
};

export default function Services() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { data: catalog, isLoading } = trpc.services.catalog.useQuery();
  const checkout = trpc.services.checkout.useMutation();

  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ businessName: "", businessType: "", businessUrl: "", notes: "" });

  const handlePurchase = async () => {
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }
    if (!selectedService) return;

    try {
      const result = await checkout.mutateAsync({
        serviceType: selectedService as any,
        businessName: form.businessName || undefined,
        businessType: form.businessType || undefined,
        businessUrl: form.businessUrl || undefined,
        notes: form.notes || undefined,
        origin: window.location.origin,
      });
      toast.success("Redirecting to checkout...");
      window.open(result.checkoutUrl, "_blank");
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create checkout session");
    }
  };

  const openCheckout = (serviceKey: string) => {
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }
    setSelectedService(serviceKey);
    setForm({ businessName: "", businessType: "", businessUrl: "", notes: "" });
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5" />
        <div className="relative container py-20 text-center">
          <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
          <Badge variant="secondary" className="mb-4 px-4 py-1.5 text-sm">
            <Zap className="mr-1 h-3 w-3" /> Professional Services
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            Authenticity as a <span className="text-primary">Service</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            From $99 landing pages to $2,500 government dossiers. We build trust infrastructure for your brand, products, and supply chain.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Check className="h-4 w-4 text-green-500" /> Live Stripe Payments</span>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4 text-blue-500" /> 24h–10 day delivery</span>
            <span className="flex items-center gap-1"><Star className="h-4 w-4 text-yellow-500" /> AI-Powered Reports</span>
          </div>
        </div>
      </section>

      {/* Service Cards */}
      <section className="container py-16">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {catalog?.map((service) => {
              const Icon = ICON_MAP[service.icon] || Shield;
              return (
                <Card
                  key={service.key}
                  className={`relative flex flex-col transition-all hover:shadow-lg hover:border-primary/50 ${
                    service.featured ? "ring-2 ring-primary/30 shadow-lg" : ""
                  }`}
                >
                  {service.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground px-3 py-0.5">
                        <Star className="mr-1 h-3 w-3" /> Featured
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <span className="text-2xl font-bold text-primary">{service.displayPrice}</span>
                    </div>
                    <CardTitle className="text-xl">{service.name}</CardTitle>
                    <CardDescription className="text-sm italic">{service.tagline}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Deliverables</p>
                      <ul className="space-y-1">
                        {service.deliverables.map((d: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Delivery: {service.deliveryTime}</span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" size="lg" onClick={() => openCheckout(service.key)}>
                      Get Started <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Target Audiences */}
      <section className="container py-16 border-t">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Who This Is For</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Whether you're a local dispensary or a government agency, we have a trust solution for you.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <div className="h-14 w-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Globe className="h-7 w-7 text-green-500" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Local Businesses</h3>
            <p className="text-sm text-muted-foreground">Dispensaries, boutiques, resale shops, collectibles stores, maker studios</p>
          </div>
          <div className="text-center p-6">
            <div className="h-14 w-14 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <Bot className="h-7 w-7 text-blue-500" />
            </div>
            <h3 className="font-semibold text-lg mb-2">E-Commerce Brands</h3>
            <p className="text-sm text-muted-foreground">Shopify sellers, Etsy makers, small brands, creators, artisans</p>
          </div>
          <div className="text-center p-6">
            <div className="h-14 w-14 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-7 w-7 text-purple-500" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Government & Enterprise</h3>
            <p className="text-sm text-muted-foreground">County offices, tribal governments, law enforcement, economic development boards</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-16 text-center border-t">
        <h2 className="text-3xl font-bold mb-4">Ready to Build Trust?</h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          Start with a $99 landing page or go all-in with a $2,500 government dossier. Every service includes AI-powered analysis.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button size="lg" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            View Services
          </Button>
          {user && (
            <Button variant="outline" size="lg" onClick={() => navigate("/orders")}>
              My Orders
            </Button>
          )}
        </div>
      </section>

      {/* Checkout Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedService && catalog?.find((s) => s.key === selectedService)?.name}
            </DialogTitle>
            <DialogDescription>
              Tell us about your business so we can tailor the deliverables.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                placeholder="Your business name"
                value={form.businessName}
                onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type</Label>
              <Input
                id="businessType"
                placeholder="e.g. Dispensary, Boutique, E-commerce"
                value={form.businessType}
                onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessUrl">Website URL (optional)</Label>
              <Input
                id="businessUrl"
                placeholder="https://yourbusiness.com"
                value={form.businessUrl}
                onChange={(e) => setForm((f) => ({ ...f, businessUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any specific requirements or details..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePurchase} disabled={checkout.isPending}>
              {checkout.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                <>Proceed to Checkout <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
