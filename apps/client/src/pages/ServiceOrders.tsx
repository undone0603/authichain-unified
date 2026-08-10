import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Package, ExternalLink, Clock, CheckCircle, XCircle, Loader2, ArrowRight, ShoppingBag } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  pending: { label: "Pending Payment", variant: "outline", icon: Clock },
  paid: { label: "Paid", variant: "secondary", icon: CheckCircle },
  in_progress: { label: "In Progress", variant: "default", icon: Loader2 },
  delivered: { label: "Delivered", variant: "secondary", icon: CheckCircle },
  cancelled: { label: "Cancelled", variant: "destructive", icon: XCircle },
};

const SERVICE_NAMES: Record<string, string> = {
  authenticity_audit: "Authenticity Intelligence Audit",
  cinematic_page: "QRON Cinematic Product Page",
  automation_setup: "AI Automation Setup",
  landing_page: "Authenticity Landing Page",
  brand_story_pack: "Brand Story Intelligence Pack",
  government_dossier: "Government-Ready Intelligence Dossier",
};

export default function ServiceOrders() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { data: orders, isLoading } = trpc.services.myOrders.useQuery(undefined, { enabled: !!user });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="container max-w-4xl py-12">
        <h1 className="text-3xl font-bold mb-2">My Service Orders</h1>
        <p className="text-muted-foreground mb-8">Track your purchased services and deliverables.</p>
        <Card className="text-center py-16">
          <CardContent>
            <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No orders yet</h3>
            <p className="text-muted-foreground mb-6">Browse our services to get started with trust infrastructure.</p>
            <Button onClick={() => navigate("/services")}>
              Browse Services <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Service Orders</h1>
          <p className="text-muted-foreground">Track your purchased services and deliverables.</p>
        </div>
        <Button onClick={() => navigate("/services")}>
          Browse Services <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        {orders.map((order: any) => {
          const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
          const StatusIcon = statusConfig.icon;
          return (
            <Card key={order.id} className="transition-all hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {SERVICE_NAMES[order.serviceType] || order.serviceType}
                      </CardTitle>
                      <CardDescription>
                        Order #{order.id} &middot; {new Date(order.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                    <StatusIcon className={`h-3 w-3 ${order.status === "in_progress" ? "animate-spin" : ""}`} />
                    {statusConfig.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Amount</p>
                    <p className="font-semibold">${(order.amount / 100).toFixed(2)}</p>
                  </div>
                  {order.businessName && (
                    <div>
                      <p className="text-muted-foreground text-xs">Business</p>
                      <p className="font-medium">{order.businessName}</p>
                    </div>
                  )}
                  {order.businessType && (
                    <div>
                      <p className="text-muted-foreground text-xs">Type</p>
                      <p className="font-medium">{order.businessType}</p>
                    </div>
                  )}
                  {order.deliveredAt && (
                    <div>
                      <p className="text-muted-foreground text-xs">Delivered</p>
                      <p className="font-medium">{new Date(order.deliveredAt).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
                {order.deliveryUrl && (
                  <div className="mt-4 pt-4 border-t">
                    <Button variant="outline" size="sm" asChild>
                      <a href={order.deliveryUrl} target="_blank" rel="noopener noreferrer">
                        View Deliverable <ExternalLink className="ml-2 h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                )}
                {order.notes && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">Notes: {order.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
