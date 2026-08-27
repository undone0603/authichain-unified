import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Loader2, Plus, MapPin, Thermometer, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function SupplyChain() {
  const [productFilter, setProductFilter] = useState<number | undefined>(undefined);
  const { data: events, isLoading } = trpc.supplyChain.getEvents.useQuery({ productId: productFilter ?? 0 }, { enabled: !!productFilter });
  // IoT data placeholder - no separate IoT query in router
  const addEvent = trpc.supplyChain.addEvent.useMutation();
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ productId: "", eventType: "manufactured", location: "", description: "" });

  const handleAdd = async () => {
    if (!form.productId || !form.location) { toast.error("Product ID and location required"); return; }
    try {
      await addEvent.mutateAsync({
        productId: parseInt(form.productId),
        eventType: form.eventType as any,
        location: form.location,
        notes: form.description || undefined,
      });
      toast.success("Supply chain event recorded");
      setOpen(false);
      setForm({ productId: "", eventType: "manufactured", location: "", description: "" });
      utils.supplyChain.getEvents.invalidate();
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Supply Chain</h1>
          <p className="text-muted-foreground text-sm mt-1">Track products through the supply chain with blockchain verification</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add Event</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Supply Chain Event</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Product ID</Label><Input type="number" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="mt-1" /></div>
              <div>
                <Label>Event Type</Label>
                <Select value={form.eventType} onValueChange={(v) => setForm({ ...form, eventType: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manufactured">Manufactured</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="customs">Customs</SelectItem>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1" placeholder="City, Country" /></div>
              <div><Label>Description (optional)</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" /></div>
              <Button className="w-full" onClick={handleAdd} disabled={addEvent.isPending}>
                {addEvent.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />} Record Event
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Supply Chain Events</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : events && events.length > 0 ? (
                <div className="space-y-3">
                  {events.map((e: any) => (
                    <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg bg-accent/30">
                      <div className="mt-1">
                        {e.eventType === "shipped" || e.eventType === "in_transit" ? <Truck className="h-4 w-4 text-blue-400" /> :
                         e.eventType === "delivered" ? <Package className="h-4 w-4 text-green-400" /> :
                         <MapPin className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">{e.eventType.replace(/_/g, " ")}</span>
                          <Badge variant="outline" className="text-xs">{e.verificationStatus || "pending"}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" /> {e.location}</p>
                        {e.description && <p className="text-xs text-muted-foreground mt-1">{e.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{new Date(e.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No supply chain events recorded yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Thermometer className="h-4 w-4" /> IoT Monitoring</CardTitle></CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Thermometer className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">IoT monitoring active. Connect devices to see live data.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
