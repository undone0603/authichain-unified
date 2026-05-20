import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, FileCheck, AlertCircle, CheckCircle2, Search, Filter } from "lucide-react";

const RegulatoryDemo = () => {
  const complianceData = [
    {
      id: "REG-2024-001",
      standard: "GDPR Article 32",
      status: "Compliant",
      lastAudit: "2024-03-15",
      score: 98,
      details: "Security of processing - technical and organizational measures implemented."
    },
    {
      id: "REG-2024-002",
      standard: "ISO/IEC 27001",
      status: "Review Required",
      lastAudit: "2024-02-20",
      score: 85,
      details: "Information security management system documentation needs update."
    },
    {
      id: "REG-2024-003",
      standard: "SOC 2 Type II",
      status: "Compliant",
      lastAudit: "2024-03-01",
      score: 100,
      details: "Trust services criteria for security, availability, and confidentiality met."
    }
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Regulatory Audit Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time compliance monitoring and audit trails.</p>
        </div>
        <div className="flex gap-3">
          <Badge variant="outline" className="px-4 py-1 border-primary/50 bg-primary/10 text-primary">
            <Shield className="w-4 h-4 mr-2" />
            Active Monitoring
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <CheckCircle2 className="h-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94.3%</div>
            <p className="text-xs text-muted-foreground mt-1">+2.1% from last month</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Controls</CardTitle>
            <FileCheck className="h-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">124/128</div>
            <p className="text-xs text-muted-foreground mt-1">4 pending review</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Findings</CardTitle>
            <AlertCircle className="h-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground mt-1">3 high priority</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Audit Frameworks</CardTitle>
              <CardDescription>Current status across major regulatory standards</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search standards..."
                  className="pl-9 h-9 w-64 bg-slate-950 border-slate-800 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-md text-sm hover:bg-slate-700">
                <Filter className="w-4 h-4" />
                Filter
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {complianceData.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 rounded-lg border border-slate-800 bg-slate-950/50 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex gap-4 items-center">
                  <div className={`p-2 rounded-full ${item.status === 'Compliant' ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
                    {item.status === 'Compliant' ? (
                      <CheckCircle2 className={`w-5 h-5 ${item.status === 'Compliant' ? 'text-green-500' : 'text-amber-500'}`} />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold">{item.standard}</h4>
                    <p className="text-sm text-muted-foreground">{item.details}</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Last Audit</p>
                    <p className="text-sm font-medium">{item.lastAudit}</p>
                  </div>
                  <div className="w-24">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Score</span>
                      <span>{item.score}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.score === 100 ? 'bg-green-500' : 'bg-amber-500'}`}
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                  </div>
                  <Badge
                    className={
                      item.status === 'Compliant'
                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }
                  >
                    {item.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegulatoryDemo;
