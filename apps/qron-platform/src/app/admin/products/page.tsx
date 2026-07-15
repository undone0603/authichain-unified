export const dynamic = 'force-dynamic';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { 
  Package, 
  Plus, 
  ChevronRight, 
  Box
} from 'lucide-react';

export default async function AdminProductsPage() {
  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gold/10 border border-gold/20 rounded-2xl text-gold">
              <Box className="w-8 h-8" />
            </div>
            <div>
                <h1 className="text-4xl font-black tracking-tight uppercase">
                    PRODUCT <span className="gold-text">REGISTRY</span>
                </h1>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                    Industrial Asset Management
                </p>
            </div>
          </div>
          <Link
            href="/admin/products/new"
            className="btn-gold px-8 py-3 rounded-xl flex items-center gap-2 font-black uppercase tracking-widest text-[10px] shadow-gold"
          >
            <Plus className="w-4 h-4" />
            New Product
          </Link>
        </header>

        {error && (
          <div className="protocol-card p-6 bg-red-500/5 border-red-500/20 text-red-400 mb-8 font-bold text-sm uppercase">
            Protocol Error: {error.message}
          </div>
        )}

        {!products || products.length === 0 ? (
          <div className="protocol-card p-20 text-center border-zinc-900 bg-zinc-950/50">
            <Package className="w-12 h-12 text-zinc-800 mx-auto mb-6" />
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm mb-8">No industrial assets found</p>
            <Link href="/admin/products/new" className="text-gold font-black uppercase tracking-tighter hover:underline">
              Initialize first product â†’
            </Link>
          </div>
        ) : (
          <div className="protocol-card overflow-hidden bg-zinc-950/30 border-zinc-900">
            <table className="w-full text-left">
              <thead className="bg-zinc-900/50 border-b border-zinc-800">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Asset Details</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Manufacturer</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Compliance Category</th>
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {products.map((product) => (
                  <tr key={product.id} className="group hover:bg-gold/[0.02] transition-colors">
                    <td className="px-8 py-6">
                      <div className="font-black text-white uppercase tracking-tight mb-1">{product.name}</div>
                      <div className="text-[10px] font-mono text-zinc-600 uppercase">UID: {product.model_number || 'STND-UNIT'}</div>
                    </td>
                    <td className="px-8 py-6 text-zinc-400 font-bold uppercase text-xs">{product.manufacturer}</td>
                    <td className="px-8 py-6">
                      <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 text-[9px] font-black uppercase tracking-widest">
                        {product.category || 'General'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <Link
                        href={`/admin/certifications?product_id=${product.id}`}
                        className="flex items-center gap-2 text-gold font-black uppercase tracking-tighter text-xs hover:gap-3 transition-all"
                      >
                        Issue Certs <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
