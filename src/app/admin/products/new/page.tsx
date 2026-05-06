'use client';

import { useState } from 'react';
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
  Hash
} from 'lucide-react';

export default function NewProductPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    manufacturer: '',
    model_number: '',
    category: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create product');
      router.push('/admin/products');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
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

        {error && (
          <div className="protocol-card p-4 bg-red-500/5 border-red-500/20 text-red-400 mb-8 font-bold text-xs uppercase tracking-widest text-center">
            {error}
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
                  <Box className="w-3 h-3" /> Manufacturer *
                </label>
                <input
                  type="text"
                  required
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
                  value={formData.model_number}
                  onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
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
            disabled={isLoading}
            className="w-full btn-gold py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-gold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register Product'}
          </button>
        </form>
      </div>
    </div>
  );
}
