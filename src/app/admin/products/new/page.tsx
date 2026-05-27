'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Box,
  ArrowLeft,
  Plus,
  Loader2,
  Package,
  FileText,
  Tag,
  Hash,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function NewProductPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    manufacturer: '',
    modelNumber: '',
    category: '',
  });

  const createProduct = trpc.products.create.useMutation({
    onSuccess: () => router.push('/admin/products'),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProduct.mutateAsync({
      name: formData.name,
      description: formData.description || undefined,
      manufacturer: formData.manufacturer || undefined,
      modelNumber: formData.modelNumber || undefined,
      category: formData.category || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gold/10 border border-gold/20 rounded-xl text-gold">
              <Plus className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Register Asset</h1>
          </div>
          <Link href="/admin/products" className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </header>

        {createProduct.isError && (
          <div className="protocol-card p-4 bg-red-500/5 border-red-500/20 text-red-400 mb-8 font-bold text-xs uppercase tracking-widest text-center">
            {createProduct.error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="protocol-card p-8 bg-zinc-950/50 border-zinc-900 space-y-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">
                <Package className="w-3 h-3" /> Product Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-gold outline-none transition-colors"
                placeholder="e.g. Genesis S1 Hub"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">
                <FileText className="w-3 h-3" /> Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-gold outline-none transition-colors"
                rows={4}
                placeholder="Industrial specification..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">
                  <Box className="w-3 h-3" /> Manufacturer
                </label>
                <input
                  type="text"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-gold outline-none transition-colors"
                  placeholder="Acme Corp"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">
                  <Hash className="w-3 h-3" /> Model Identifier
                </label>
                <input
                  type="text"
                  value={formData.modelNumber}
                  onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-gold outline-none transition-colors"
                  placeholder="ACM-H1-26"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] ml-1">
                <Tag className="w-3 h-3" /> Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-gold outline-none transition-colors"
                placeholder="Electronics"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={createProduct.isPending}
            className="w-full btn-gold py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-gold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {createProduct.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register Product'}
          </button>
        </form>
      </div>
    </div>
  );
}
