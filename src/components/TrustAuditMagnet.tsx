'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldCheck, ArrowRight, Loader2, Mail, Lock, Zap } from 'lucide-react';

export function TrustAuditMagnet() {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');

  const capture = (trpc as any).leads.capture.useMutation({
    onSuccess: () => {
      toast.success("Audit Requested!", {
        description: "AgentZ is analyzing your brand. Check your email shortly."
      });
      setEmail('');
      setCompany('');
    },
    onError: (err: any) => toast.error("Request failed", { description: err.message })
  });

  const handleSubmit = () => {
    if (!email) return toast.error("Email required");
    capture.mutate({ email, company, source: 'trust_audit_magnet' });
  };

  return (
    <Card className="bg-zinc-950 border-gold/20 overflow-hidden relative group shadow-[0_0_50px_rgba(212,175,55,0.05)]">
      <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 blur-[100px] rounded-full translate-x-1/3 -translate-y-1/3" />
      
      <CardHeader className="text-center pt-12 pb-8">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-6">
          <ShieldCheck className="w-6 h-6 text-gold" />
        </div>
        <CardTitle className="text-3xl font-black uppercase tracking-tighter italic">
          Free Product <span className="gold-text">Trust Audit</span>
        </CardTitle>
        <CardDescription className="text-zinc-500 uppercase text-[10px] font-bold tracking-[0.3em] mt-2">
          AI-Native Brand Vulnerability Scan
        </CardDescription>
      </CardHeader>

      <CardContent className="px-8 pb-12 relative z-10 max-w-md mx-auto">
        <p className="text-zinc-400 text-xs text-center leading-relaxed mb-8 uppercase font-medium tracking-tight">
          Enter your details to receive a complimentary forensic report on your brand's counterfeit risk and a custom <span className="text-white">AuthiChain Implementation Roadmap.</span>
        </p>

        <div className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-3.5 w-4 h-4 text-zinc-600" />
            <Input 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="WORK EMAIL" 
              className="pl-12 h-12 bg-zinc-900 border-zinc-800 focus:border-gold/50 text-[10px] font-black tracking-widest"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-3.5 w-4 h-4 text-zinc-600" />
            <Input 
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="COMPANY NAME" 
              className="pl-12 h-12 bg-zinc-900 border-zinc-800 focus:border-gold/50 text-[10px] font-black tracking-widest"
            />
          </div>
          
          <Button 
            onClick={handleSubmit}
            disabled={capture.isLoading}
            className="w-full h-14 btn-gold gap-4 font-black uppercase tracking-[0.2em] text-xs shadow-gold group"
          >
            {capture.isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
            Get Free Audit
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        <div className="mt-8 flex justify-center gap-6 grayscale opacity-30">
           <div className="flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
             <span className="text-[8px] font-black uppercase text-white">NIST Compliant</span>
           </div>
           <div className="flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
             <span className="text-[8px] font-black uppercase text-white">L2 Verified</span>
           </div>
        </div>
      </CardContent>
    </Card>
  );
}
