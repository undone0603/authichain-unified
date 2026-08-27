import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CloudLightning, FileText, CheckCircle2, AlertTriangle, Send, Loader2, Info } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function SbaDisasterLoan() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dossier, setDossier] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    businessName: "",
    industry: "",
    disasterType: "Economic Injury (EIDL)",
    impactDescription: "",
  });

  const chatMutation = trpc.ai.chat.useMutation();

  const handleGenerateDossier = async () => {
    if (!formData.businessName || !formData.impactDescription) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const response = await chatMutation.mutateAsync({
        messages: [
          {
            role: "user",
            content: `As an SBA Disaster Loan Specialist, generate a comprehensive SBA Disaster Loan Application Dossier for:
            Business: ${formData.businessName}
            Industry: ${formData.industry}
            Disaster Type: ${formData.disasterType}
            Impact: ${formData.impactDescription}
            
            Include:
            1. Executive Summary
            2. Economic Injury Analysis
            3. Operational Impact Statement
            4. Required Documents Checklist (Forms 5, 5C, 413, 2202, etc.)
            5. Recommendations for submission.`
          }
        ]
      });
      const content = Array.isArray(response.content) 
        ? response.content.map(c => ("text" in c ? c.text : "")).join("\n")
        : response.content;
      setDossier(content);
      toast.success("Dossier generated successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate dossier");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CloudLightning className="h-8 w-8 text-blue-500" />
            SBA Natural Disaster Loan Assistant
          </h1>
          <p className="text-muted-foreground mt-1">
            Enterprise-grade AI preparation for disaster recovery funding.
          </p>
        </div>
        <div className="flex gap-4">
          <Badge variant="outline" className="px-3 py-1 border-blue-500/50 text-blue-400 bg-blue-500/10">
            GovChain Vertical
          </Badge>
          <Badge variant="outline" className="px-3 py-1 border-blue-500/50 text-blue-400 bg-blue-500/10">
            Executive Recovery Mode
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Business Context</CardTitle>
              <CardDescription>Provide details about the disaster impact</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Legal Name</Label>
                <Input 
                  id="businessName" 
                  placeholder="e.g. Acme Manufacturing LLC" 
                  value={formData.businessName}
                  onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input 
                  id="industry" 
                  placeholder="e.g. Logistics & Distribution" 
                  value={formData.industry}
                  onChange={(e) => setFormData({...formData, industry: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="impact">Impact Description</Label>
                <Textarea 
                  id="impact" 
                  placeholder="Describe how the disaster affected your revenue and operations..." 
                  className="min-h-[120px]"
                  value={formData.impactDescription}
                  onChange={(e) => setFormData({...formData, impactDescription: e.target.value})}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700" 
                onClick={handleGenerateDossier}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing Impact...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Generate Application Dossier
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card className="bg-muted/50 border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-400" />
                SBA Requirements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-xs space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  SBA Form 5 (Business Loan Application)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  IRS Form 4506-C (Tax Transcript)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  SBA Form 2202 (Schedule of Liabilities)
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col min-h-[600px] border-blue-500/20 shadow-lg shadow-blue-500/5">
            <CardHeader className="border-b">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-400" />
                  Application Dossier Intelligence
                </CardTitle>
                {dossier && (
                  <Button variant="outline" size="sm" onClick={() => {
                    const blob = new Blob([dossier], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `SBA_Disaster_Dossier_${formData.businessName.replace(/\s+/g, '_')}.md`;
                    a.click();
                  }}>
                    Export as Markdown
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {dossier ? (
                <ScrollArea className="h-[600px] w-full p-6">
                  <div className="prose prose-invert max-w-none whitespace-pre-wrap font-mono text-sm leading-relaxed">
                    {dossier}
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-4">
                  <div className="h-20 w-20 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <CloudLightning className="h-10 w-10 text-blue-500/40" />
                  </div>
                  <div>
                    <h3 className="text-xl font-medium">Ready for Analysis</h3>
                    <p className="text-muted-foreground max-w-md mx-auto mt-2 text-sm">
                      Input your business context and disaster details on the left to generate an institutional-grade application dossier for SBA recovery funding.
                    </p>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Time-Sensitive
                    </Badge>
                    <Badge variant="secondary" className="bg-green-500/10 text-green-400 border-green-500/20">
                      AI Verified
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
