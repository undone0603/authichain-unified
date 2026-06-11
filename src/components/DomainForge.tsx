'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Rocket, Factory, Globe, Palette, Loader2, CheckCircle2 } from 'lucide-react';

export function DomainForge() {
  const [formData, setFormData] = useState({
    id: '',
    displayName: '',
    tagline: '',
    domain: '',
    industry: '',
    primaryColor: '#d4af37',
    primaryDim: '#b8941f'
  });

  const forge = (trpc as any).admin.forgeVertical.useMutation({
    onSuccess: (data: any) => {
      toast.success("Vertical Forged Successfully!", {
        description: `Source code generated at ${data.workerPath}`
      });
    },
    onError: (err: any) => toast.error("Forge failed", { description: err.message })
  });

  const handleForge = () => {
    if (!formData.id || !formData.domain) {
      toast.error("Missing required fields (ID and Domain)");
      return;
    }
    forge.mutate(formData);
  };

  return (
    <Card className="bg-zinc-950/50 border-zinc-900 overflow-hidden relative group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2" />
      
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Factory className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-xl font-black uppercase tracking-tighter italic">Domain <span className="gold-text">Forge</span></CardTitle>
        </div>
        <CardDescription className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest">
          Programmatic Vertical Scaler (SaaS Factory)
        </CardDescription>
      </CardHeader>

      <CardContent className="relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label className="text-[10px] uppercase font-black text-zinc-600 mb-2 block">Vertical ID (kebab-case)</Label>
              <Input 
                value={formData.id} 
                onChange={e => setFormData({...formData, id: e.target.value})}
                placeholder="e.g. watchchain-io"
                className="bg-zinc-900 border-zinc-800 focus:border-primary/50"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase font-black text-zinc-600 mb-2 block">Display Name</Label>
              <Input 
                value={formData.displayName} 
                onChange={e => setFormData({...formData, displayName: e.target.value})}
                placeholder="e.g. WatchChain"
                className="bg-zinc-900 border-zinc-800 focus:border-primary/50"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase font-black text-zinc-600 mb-2 block">Tagline</Label>
              <Input 
                value={formData.tagline} 
                onChange={e => setFormData({...formData, tagline: e.target.value})}
                placeholder="e.g. Luxury Timepiece Provenance"
                className="bg-zinc-900 border-zinc-800 focus:border-primary/50"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-[10px] uppercase font-black text-zinc-600 mb-2 block">Apex Domain</Label>
              <Input 
                value={formData.domain} 
                onChange={e => setFormData({...formData, domain: e.target.value})}
                placeholder="e.g. watchchain.io"
                className="bg-zinc-900 border-zinc-800 focus:border-primary/50"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase font-black text-zinc-600 mb-2 block">Industry Focus</Label>
              <Input 
                value={formData.industry} 
                onChange={e => setFormData({...formData, industry: e.target.value})}
                placeholder="e.g. Luxury Watches"
                className="bg-zinc-900 border-zinc-800 focus:border-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] uppercase font-black text-zinc-600 mb-2 block">Primary Color</Label>
                <div className="flex gap-2">
                   <Input 
                    type="color"
                    value={formData.primaryColor} 
                    onChange={e => setFormData({...formData, primaryColor: e.target.value})}
                    className="w-12 h-10 p-1 bg-zinc-900 border-zinc-800"
                  />
                  <Input 
                    value={formData.primaryColor} 
                    onChange={e => setFormData({...formData, primaryColor: e.target.value})}
                    className="flex-1 bg-zinc-900 border-zinc-800 text-[10px] font-mono"
                  />
                </div>
              </div>
              <div>
                <Label className="text-[10px] uppercase font-black text-zinc-600 mb-2 block">Dim Accent</Label>
                 <Input 
                  type="color"
                  value={formData.primaryDim} 
                  onChange={e => setFormData({...formData, primaryDim: e.target.value})}
                  className="w-full h-10 p-1 bg-zinc-900 border-zinc-800"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-zinc-900 flex justify-between items-center">
           <div className="flex items-center gap-4 text-zinc-600">
              <div className="flex items-center gap-2">
                 <Globe className="w-3 h-3" />
                 <span className="text-[9px] font-black uppercase">Edge Deploy Ready</span>
              </div>
              <div className="flex items-center gap-2">
                 <Palette className="w-3 h-3" />
                 <span className="text-[9px] font-black uppercase">2026 Bento Spec</span>
              </div>
           </div>
           
           <Button 
             disabled={forge.isLoading}
             onClick={handleForge}
             className="btn-gold px-8 h-12 flex items-center gap-3 font-black uppercase tracking-widest text-[10px]"
           >
             {forge.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
             Forge Vertical
           </Button>
        </div>

        {forge.isSuccess && (
          <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-start gap-4">
             <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
             <div>
                <p className="text-xs font-black text-white uppercase mb-1">Worker Source Generated</p>
                <p className="text-[10px] text-zinc-500 font-mono">Next Step: Run `{forge.data.deployCommand}` to launch to production.</p>
             </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
