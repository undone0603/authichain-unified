import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ShieldCheck, Leaf, Factory, Truck, Recycle } from "lucide-react";
import { toast } from "sonner";

export default function DppPublicPortal() {
  const [serial, setSerial] = useState('');
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const verifyProduct = async () => {
    setLoading(true);
    try {
      // This would call the actual /api/verify endpoint
      const res = await fetch(`/api/verify/${serial}`);
      if (!res.ok) throw new Error("Product not found");
      const data = await res.json();
      setProduct(data);
    } catch (e) {
      toast.error("Invalid serial number or product not found");
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  if (!product) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-6">
        <Card className="w-full max-w-md text-center space-y-6">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <ShieldCheck className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">EU Digital Product Passport</CardTitle>
            <CardDescription>Verify product authenticity and sustainability credentials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input 
              placeholder="Enter Product Serial Number..." 
              value={serial} 
              onChange={(e) => setSerial(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && verifyProduct()}
            />
            <Button className="w-full" onClick={verifyProduct} disabled={loading}>
              {loading ? "Verifying..." : "Verify Authenticity"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
          Product Verified: {product.name}
        </h1>
        <Badge variant="success" className="text-sm px-3 py-1">DPP COMPLIANT</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-md flex items-center gap-2">
              <Factory className="h-4 w-4" /> Origin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{product.origin || 'Italy'}</p>
            <p className="text-xs text-muted-foreground">Manufacturer: {product.manufacturer || 'Elite Artisans Ltd'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-md flex items-center gap-2">
              <Leaf className="h-4 w-4" /> Eco-Footprint
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">Carbon: {product.carbon || '12.4kg'} CO2e</p>
            <p className="text-xs text-muted-foreground">Recycled Content: {product.recycled || '45%'} la</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-md flex items-center gap-2">
              <Recycle className="h-4 w-4" /> Circularity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">Repair Score: {product.repair || '8.5/10'}</p>
            <p className="text-xs text-muted-foreground">End-of-life: Biodegradable</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Blockchain Provenance</CardTitle>
          <CardDescription>Every event is anchored to Bitcoin L1 for permanent traceability</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {product.events?.map((event: any, i: number) => (
              <div key={i} className="flex gap-4 p-3 rounded-lg border border-border/50">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-primary" />
                  {i < product.events.length - 1 && <div className="w-0.5 h-full bg-border" />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm">{event.type}</span>
                    <span className="text-xs text-muted-foreground">{event.date}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{event.description}</p>
                  <p className="text-[10px] font-mono text-primary mt-1">Tx: {event.tx}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <Button variant="outline" onClick={() => setProduct(null)} className="w-full">
        Verify Another Product
      </Button>
    </div>
  );
}
