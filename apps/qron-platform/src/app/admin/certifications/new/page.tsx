'use client';

import React, { useState, useEffect, Suspense, startTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ShieldCheck, 
  ArrowLeft, 
  Loader2, 
  Package, 
  FileText,
  Recycle,
  Leaf,
  Hammer,
  Truck,
  Trash2,
  Cpu
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  manufacturer: string;
  model_number?: string;
}

function NewCertificationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProductId = searchParams.get('product_id') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    product_id: initialProductId,
    include_dpp: true,
    nfc_uid: '',
    dpp: {
      material_composition: [{ material: 'Polymer', percentage: '60%' }],
      carbon_footprint: '2.4',
      repairability_score: '8',
      supply_chain: [{ event: 'Source Verification', location: 'Portland, OR', date: new Date().toISOString().split('T')[0] }]
    }
  });

  async function fetchProducts() {
    try {
      const res = await fetch('/api/admin/products');
      const data = await res.json();
      setProducts(data || []);
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      setFetchLoading(false);
    }
  }

  useEffect(() => {
    startTransition(() => {
      fetchProducts();
    });
  }, []);

  const handleAddMaterial = () => {
    setFormData({
      ...formData,
      dpp: {
        ...formData.dpp,
        material_composition: [...formData.dpp.material_composition, { material: '', percentage: '' }]
      }
    });
  };

  const handleRemoveMaterial = (index: number) => {
    const newMaterials = [...formData.dpp.material_composition];
    newMaterials.splice(index, 1);
    setFormData({ ...formData, dpp: { ...formData.dpp, material_composition: newMaterials } });
  };

  const handleAddSupplyEvent = () => {
    setFormData({
      ...formData,
      dpp: {
        ...formData.dpp,
        supply_chain: [...formData.dpp.supply_chain, { event: '', location: '', date: new Date().toISOString().split('T')[0] }]
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: formData.product_id,
          nfc_uid: formData.nfc_uid,
          dpp_data: formData.include_dpp ? {
            material_composition: Object.fromEntries(formData.dpp.material_composition.map(m => [m.material, m.percentage])),
            carbon_footprint: formData.dpp.carbon_footprint,
            repairability_score: formData.dpp.repairability_score,
            supply_chain_provenance: formData.dpp.supply_chain
          } : null
        }),
      });
      if (!res.ok) throw new Error('Failed to issue certification');
      router.push('/admin/certifications');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (fetchLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gold" /></div>;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gold/10 border border-gold/20 rounded-xl text-gold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Issue Certification</h1>
          </div>
          <Link href="/admin/certifications" className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </header>

        <form onSubmit={handleSubmit} className="space-y-12">
          {/* Target Selection */}
          <section className="protocol-card p-8 bg-zinc-950/50 border-zinc-900">
            <div className="flex items-center gap-3 mb-8">
                <Package className="w-5 h-5 text-gold" />
                <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">Target Industrial Asset</h2>
            </div>
            <select 
              required
              value={formData.product_id}
              onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
              className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-4 text-sm focus:border-gold outline-none transition-colors appearance-none"
            >
              <option value="">Select Asset...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.manufacturer})</option>
              ))}
            </select>
          </section>

          {/* DPP Expansion */}
          <section className="protocol-card p-8 border-gold/10 bg-gold/[0.02]">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gold" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-white">Digital Product Passport (DPP)</h2>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={formData.include_dpp} 
                        onChange={(e) => setFormData({ ...formData, include_dpp: e.target.checked })}
                        className="sr-only peer" 
                    />
                    <div className="w-10 h-5 bg-zinc-800 rounded-full peer peer-checked:bg-gold relative transition-colors">
                        <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Include DPP Data</span>
                </label>
            </div>

            {formData.include_dpp && (
                <div className="space-y-12 animate-in fade-in slide-in-from-top-4">
                    {/* Material Composition */}
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                <Recycle className="w-3 h-3" /> Material Composition
                            </h3>
                            <button type="button" onClick={handleAddMaterial} className="text-[10px] font-black uppercase text-gold hover:underline">
                                Add Material +
                            </button>
                        </div>
                        <div className="space-y-4">
                            {formData.dpp.material_composition.map((m, i) => (
                                <div key={i} className="flex gap-4">
                                    <input 
                                        type="text" 
                                        placeholder="Material" 
                                        value={m.material} 
                                        onChange={(e) => {
                                            const newM = [...formData.dpp.material_composition];
                                            newM[i].material = e.target.value;
                                            setFormData({ ...formData, dpp: { ...formData.dpp, material_composition: newM } });
                                        }}
                                        className="flex-1 bg-black border border-zinc-800 rounded-lg px-4 py-2 text-xs outline-none focus:border-gold"
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Percentage" 
                                        value={m.percentage}
                                        onChange={(e) => {
                                            const newM = [...formData.dpp.material_composition];
                                            newM[i].percentage = e.target.value;
                                            setFormData({ ...formData, dpp: { ...formData.dpp, material_composition: newM } });
                                        }}
                                        className="w-24 bg-black border border-zinc-800 rounded-lg px-4 py-2 text-xs outline-none focus:border-gold text-center"
                                    />
                                    <button type="button" onClick={() => handleRemoveMaterial(i)} className="p-2 text-zinc-700 hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Environmental Impact */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                <Leaf className="w-3 h-3" /> Carbon Footprint
                            </h3>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="text" 
                                    value={formData.dpp.carbon_footprint}
                                    onChange={(e) => setFormData({ ...formData, dpp: { ...formData.dpp, carbon_footprint: e.target.value } })}
                                    className="flex-1 bg-black border border-zinc-800 rounded-lg px-4 py-3 text-xs outline-none focus:border-gold"
                                    placeholder="e.g. 2.4"
                                />
                                <span className="text-[10px] font-black text-zinc-600 uppercase">kg CO2e</span>
                            </div>
                        </div>

                        {/* Repairability */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                <Hammer className="w-3 h-3" /> Repairability Score (1-10)
                            </h3>
                            <input 
                                type="range" 
                                min="1" 
                                max="10" 
                                value={formData.dpp.repairability_score}
                                onChange={(e) => setFormData({ ...formData, dpp: { ...formData.dpp, repairability_score: e.target.value } })}
                                className="w-full accent-gold"
                            />
                            <div className="text-center font-black text-gold text-sm">{formData.dpp.repairability_score}/10</div>
                        </div>
                    </div>

                    {/* Supply Chain */}
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                                <Truck className="w-3 h-3" /> Supply Chain Provenance
                            </h3>
                            <button type="button" onClick={handleAddSupplyEvent} className="text-[10px] font-black uppercase text-gold hover:underline">
                                Add Event +
                            </button>
                        </div>
                        <div className="space-y-4">
                            {formData.dpp.supply_chain.map((s, i) => (
                                <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-black/40 p-4 rounded-xl border border-zinc-900">
                                    <input 
                                        type="text" 
                                        placeholder="Event (e.g. Harvest)" 
                                        value={s.event}
                                        onChange={(e) => {
                                            const newS = [...formData.dpp.supply_chain];
                                            newS[i].event = e.target.value;
                                            setFormData({ ...formData, dpp: { ...formData.dpp, supply_chain: newS } });
                                        }}
                                        className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-gold"
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Location" 
                                        value={s.location}
                                        onChange={(e) => {
                                            const newS = [...formData.dpp.supply_chain];
                                            newS[i].location = e.target.value;
                                            setFormData({ ...formData, dpp: { ...formData.dpp, supply_chain: newS } });
                                        }}
                                        className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-gold"
                                    />
                                    <input 
                                        type="date" 
                                        value={s.date}
                                        onChange={(e) => {
                                            const newS = [...formData.dpp.supply_chain];
                                            newS[i].date = e.target.value;
                                            setFormData({ ...formData, dpp: { ...formData.dpp, supply_chain: newS } });
                                        }}
                                        className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-gold text-zinc-400"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
          </section>

          {/* NFC Bridge Expansion */}
          <section className="protocol-card p-8 bg-zinc-950/50 border-zinc-900">
            <div className="flex items-center gap-3 mb-8">
                <Cpu className="w-5 h-5 text-gold" />
                <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">NFC Hardware Link (Optional)</h2>
            </div>
            <div className="space-y-4">
                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-tight">
                    Pair a physical NFC chip UID with this digital identifier for &quot;Tap to Verify&quot; support.
                </p>
                <input 
                    type="text" 
                    placeholder="NFC Chip UID (e.g. 04:E2:B3...)" 
                    value={formData.nfc_uid}
                    onChange={(e) => setFormData({ ...formData, nfc_uid: e.target.value })}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-4 text-sm font-mono focus:border-gold outline-none transition-colors"
                />
            </div>
          </section>

          <button
            type="submit"
            disabled={isLoading || !formData.product_id}
            className="w-full btn-gold py-5 rounded-xl font-black uppercase tracking-widest text-sm shadow-gold disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Issue Industrial Certificate'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function NewCertificationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gold" /></div>}>
      <NewCertificationForm />
    </Suspense>
  );
}
