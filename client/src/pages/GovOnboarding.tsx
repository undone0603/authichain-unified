import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldCheck, Landmark, Factory, CheckCircle2, Loader2 } from "lucide-react";

export default function GovOnboarding() {
  const [, setLocation] = useLocation();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const createDeal = trpc.govchain.createSovereignDeal.useMutation({
    onSuccess: () => {
      setIsSubmitted(true);
      toast.success("Sovereign Deal Staged Successfully");
    },
    onError: (err: { message: string }) => toast.error(err.message)
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createDeal.mutate({
      manufacturerName: formData.get("name") as string,
      contactEmail: (formData.get("email") as string) || "contact@agency.gov",
      dealType: (formData.get("type") as string | null) as "procurement" | "compliance" | "passport" | "supply_chain" | undefined,
      description: (formData.get("description") as string) || undefined,
    });
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-blue-500 bg-gray-900 text-center">
          <CardContent className="pt-10 pb-10">
            <CheckCircle2 className="w-16 h-16 text-blue-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-white mb-2">Protocol Deal Staged</h2>
            <p className="text-gray-400 mb-8">Your manufacturing record has been sealed to the AuthiChain Truth Layer. An advisor will contact you within 24 hours.</p>
            <Button onClick={() => setLocation("/")} className="w-full bg-blue-600">Return to GovChain</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <Landmark className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-4">Sovereign Onboarding</h1>
          <p className="text-gray-400">Register your manufacturing facility as an official partner of the AuthiChain Economy.</p>
        </div>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Manufacturer Intake</CardTitle>
            <CardDescription>All data is hashed and sealed to the immutable protocol ledger.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-gray-300">Manufacturer Name</Label>
                  <Input id="name" name="name" required className="bg-gray-800 border-gray-700 text-white" placeholder="Acme Precision Defense" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-gray-300">Deal Vertical</Label>
                  <Select name="type" defaultValue="MADE_IN_USA">
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="Select Vertical" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      <SelectItem value="MADE_IN_USA">Made in the USA</SelectItem>
                      <SelectItem value="GOV_CONTRACT">Government Contract</SelectItem>
                      <SelectItem value="INFRASTRUCTURE">Critical Infrastructure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="value" className="text-gray-300">Contract Value (Est. Annual)</Label>
                <Input id="value" name="value" type="number" className="bg-gray-800 border-gray-700 text-white" placeholder="500000" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-300">Capabilities & Facility Details</Label>
                <Textarea id="description" name="description" required className="bg-gray-800 border-gray-700 text-white min-h-[120px]" placeholder="Briefly describe your manufacturing process and location..." />
              </div>

              <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 flex items-start gap-4">
                <ShieldCheck className="w-6 h-6 text-blue-500 mt-1" />
                <p className="text-xs text-gray-400 leading-relaxed">
                  By submitting, you certify that all manufacturing data is accurate. AuthiChain Protocol will perform an autonomous forensic sweep of your supply chain logs.
                </p>
              </div>

              <Button type="submit" disabled={createDeal.isPending} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12">
                {createDeal.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sealing Record...</> : "Submit Sovereign Application"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
