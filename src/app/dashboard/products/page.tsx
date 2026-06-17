'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  Package, QrCode, ScanLine, Plus, RefreshCw,
  ShieldCheck, Download, Copy, ExternalLink, X, Activity,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const EMPTY_FORM = { name: '', brand: '', category: '', description: '', imageUrl: '', serialNumber: '', batchNumber: '' };

export default function ProductsPage() {
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [batchId, setBatchId] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const productsQuery = trpc.products.list.useQuery(undefined, { staleTime: 30_000 });
  const qrCodesQuery = trpc.qrcode.listForProduct.useQuery(
    { productId: selectedProductId! },
    { enabled: selectedProductId !== null, staleTime: 10_000 }
  );

  const scanHistoryQuery = trpc.qrcode.scanHistory.useQuery(
    { productId: selectedProductId! },
    { enabled: selectedProductId !== null, staleTime: 30_000 }
  );

  const generateQR = trpc.qrcode.generate.useMutation({
    onSuccess: () => qrCodesQuery.refetch(),
  });

  const createProduct = trpc.products.create.useMutation({
    onSuccess: (product) => {
      productsQuery.refetch();
      setSelectedProductId(product.id);
      setShowNewProduct(false);
      setForm(EMPTY_FORM);
    },
  });

  async function handleGenerate() {
    if (!selectedProductId) return;
    await generateQR.mutateAsync({
      productId: selectedProductId,
      size: 400,
      batchId: batchId.trim() || undefined,
    });
    setBatchId('');
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await createProduct.mutateAsync({
      name: form.name.trim(),
      brand: form.brand.trim() || undefined,
      category: form.category.trim() || undefined,
      description: form.description.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      serialNumber: form.serialNumber.trim() || undefined,
      batchNumber: form.batchNumber.trim() || undefined,
    });
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  }

  const selectedProduct = productsQuery.data?.find(p => p.id === selectedProductId);

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-widest gold-text">
            Products & QR Codes
          </h1>
          <p className="text-zinc-500 text-xs mt-1 uppercase tracking-wider">
            Generate tamper-evident QR codes for your products
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-xs font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest"
        >
          ← Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="protocol-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-4 h-4 text-gold" />
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-400">
                Your Products
              </h2>
              <button
                onClick={() => productsQuery.refetch()}
                className="ml-auto text-zinc-600 hover:text-zinc-400"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {productsQuery.isLoading && (
              <p className="text-zinc-600 text-xs text-center py-8">Loading…</p>
            )}

            {productsQuery.error && (
              <p className="text-red-400 text-xs text-center py-4">
                {productsQuery.error.message}
              </p>
            )}

            {productsQuery.data?.length === 0 && !showNewProduct && (
              <div className="text-center py-8">
                <Package className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-zinc-600 text-xs uppercase tracking-widest">No products yet</p>
              </div>
            )}

            <div className="space-y-2">
              {productsQuery.data?.map(product => (
                <button
                  key={product.id}
                  onClick={() => { setSelectedProductId(product.id); setShowNewProduct(false); }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedProductId === product.id
                      ? 'border-gold/40 bg-gold/10'
                      : 'border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <p className="font-bold text-sm truncate">{product.name}</p>
                  {product.brand && (
                    <p className="text-zinc-500 text-[10px] uppercase tracking-widest mt-0.5">
                      {product.brand}
                    </p>
                  )}
                  {product.category && (
                    <span className="inline-block mt-1 text-[9px] font-bold text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5 uppercase">
                      {product.category}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => { setShowNewProduct(v => !v); setSelectedProductId(null); }}
              className="mt-3 w-full flex items-center justify-center gap-2 border border-dashed border-zinc-700 hover:border-gold/40 text-zinc-500 hover:text-gold rounded-lg py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors"
            >
              <Plus className="w-3 h-3" />
              New Product
            </button>
          </div>
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* New Product Form */}
          {showNewProduct && (
            <div className="protocol-card p-6">
              <div className="flex items-center gap-2 mb-5">
                <Plus className="w-4 h-4 text-gold" />
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">New Product</h3>
                <button
                  onClick={() => { setShowNewProduct(false); setForm(EMPTY_FORM); createProduct.reset(); }}
                  className="ml-auto text-zinc-600 hover:text-zinc-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-1">Name *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Premium Leather Wallet"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-gold/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-1">Brand</label>
                    <input
                      type="text"
                      placeholder="Brand name"
                      value={form.brand}
                      onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-gold/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-1">Category</label>
                    <input
                      type="text"
                      placeholder="e.g. Apparel"
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-gold/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-1">Serial Number</label>
                    <input
                      type="text"
                      placeholder="Optional serial"
                      value={form.serialNumber}
                      onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-gold/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-1">Batch Number</label>
                    <input
                      type="text"
                      placeholder="Optional batch"
                      value={form.batchNumber}
                      onChange={e => setForm(f => ({ ...f, batchNumber: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-gold/40"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-1">Image URL</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={form.imageUrl}
                      onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-gold/40"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-1">Description</label>
                    <textarea
                      rows={2}
                      placeholder="Short product description"
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-gold/40 resize-none"
                    />
                  </div>
                </div>

                {createProduct.isError && (
                  <p className="text-xs text-red-400">{createProduct.error.message}</p>
                )}

                <button
                  type="submit"
                  disabled={createProduct.isPending || !form.name.trim()}
                  className="btn-gold w-full py-2.5 rounded-lg text-xs font-black uppercase tracking-widest shadow-gold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {createProduct.isPending ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                  Create Product
                </button>
              </form>
            </div>
          )}

          {!selectedProduct && !showNewProduct && (
            <div className="protocol-card p-12 flex flex-col items-center justify-center text-center">
              <QrCode className="w-12 h-12 text-zinc-700 mb-4" />
              <p className="text-zinc-500 text-sm uppercase tracking-widest font-bold">
                Select a product to manage QR codes
              </p>
            </div>
          )}

          {selectedProduct && (
            <>
              {/* Generate new QR */}
              <div className="protocol-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Plus className="w-4 h-4 text-gold" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">
                    Generate QR Code
                  </h3>
                  <span className="ml-2 text-[10px] font-bold text-gold border border-gold/20 rounded px-1.5 py-0.5">
                    {selectedProduct.name}
                  </span>
                </div>

                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="Batch ID (optional)"
                    value={batchId}
                    onChange={e => setBatchId(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-gold/40"
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={generateQR.isPending}
                    className="btn-gold px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest shadow-gold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {generateQR.isPending ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <QrCode className="w-3 h-3" />
                    )}
                    Generate
                  </button>
                </div>

                {generateQR.isSuccess && generateQR.data && (
                  <div className="mt-4 p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className="w-4 h-4 text-green-400" />
                      <span className="text-xs font-bold text-green-400 uppercase tracking-widest">
                        QR Code Generated
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 font-mono break-all">
                      {generateQR.data.verifyUrl}
                    </p>
                  </div>
                )}

                {generateQR.isError && (
                  <p className="mt-3 text-xs text-red-400">{generateQR.error.message}</p>
                )}
              </div>

              {/* QR Code List */}
              <div className="protocol-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ScanLine className="w-4 h-4 text-gold" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">
                    QR History
                  </h3>
                  {qrCodesQuery.data && (
                    <span className="ml-auto text-[10px] text-zinc-600 font-bold">
                      {qrCodesQuery.data.length} code{qrCodesQuery.data.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {qrCodesQuery.isLoading && (
                  <p className="text-zinc-600 text-xs text-center py-6">Loading…</p>
                )}

                {qrCodesQuery.data?.length === 0 && (
                  <p className="text-zinc-600 text-xs text-center py-6 uppercase tracking-widest">
                    No QR codes yet
                  </p>
                )}

                <div className="space-y-3">
                  {qrCodesQuery.data?.map(qr => {
                    // The qr_codes row type has no `metadata` column; read it
                    // defensively in case the runtime row carries extra json.
                    const meta = (qr as { metadata?: Record<string, unknown> | null }).metadata ?? null;
                    const hasHash = !!meta?.hash;
                    const verifyUrl = qr.qrData;

                    return (
                      <div key={qr.id} className="border border-zinc-800 rounded-xl p-4 flex gap-4">
                        {qr.qrImageUrl && (
                          <div className="shrink-0">
                            <Image
                              src={qr.qrImageUrl}
                              alt="QR Code"
                              width={80}
                              height={80}
                              className="rounded-lg"
                              unoptimized
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {hasHash && (
                              <span className="text-[9px] font-black text-green-400 border border-green-500/20 rounded px-1.5 py-0.5 uppercase tracking-widest">
                                Verified
                              </span>
                            )}
                            <span className="text-[10px] text-zinc-600 font-bold">
                              {new Date(qr.createdAt).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] text-zinc-600">
                              {qr.scanCount ?? 0} scan{(qr.scanCount ?? 0) !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-[10px] font-mono text-zinc-500 truncate">
                            {verifyUrl}
                          </p>
                          {!!meta?.expiresAt && (
                            <p className="text-[9px] text-zinc-700 mt-1">
                              Expires {new Date(meta.expiresAt as string).toLocaleDateString()}
                            </p>
                          )}

                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => copyUrl(verifyUrl)}
                              className="flex items-center gap-1 text-[9px] font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest"
                            >
                              <Copy className="w-2.5 h-2.5" />
                              {copiedUrl === verifyUrl ? 'Copied!' : 'Copy URL'}
                            </button>
                            <Link
                              href={verifyUrl}
                              target="_blank"
                              className="flex items-center gap-1 text-[9px] font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              Open
                            </Link>
                            {qr.qrImageUrl && (
                              <a
                                href={qr.qrImageUrl}
                                download={`qr-${qr.id}.png`}
                                className="flex items-center gap-1 text-[9px] font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest"
                              >
                                <Download className="w-2.5 h-2.5" />
                                Download
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scan History */}
              <div className="protocol-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-gold" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">
                    Scan History
                  </h3>
                  {scanHistoryQuery.data && (
                    <span className="ml-auto text-[10px] text-zinc-600 font-bold">
                      last {scanHistoryQuery.data.length}
                    </span>
                  )}
                </div>

                {scanHistoryQuery.isLoading && (
                  <p className="text-zinc-600 text-xs text-center py-4">Loading…</p>
                )}

                {scanHistoryQuery.data?.length === 0 && (
                  <p className="text-zinc-600 text-xs text-center py-4 uppercase tracking-widest">
                    No scans recorded yet
                  </p>
                )}

                <div className="space-y-2">
                  {scanHistoryQuery.data?.map(event => {
                    // Scan events are activity-ledger rows; authenticity is stored
                    // inside the loosely-typed `details` json and the timestamp is `createdAt`.
                    const isAuthentic = (event.details as { isAuthentic?: boolean } | null)?.isAuthentic ?? null;
                    return (
                    <div key={event.id} className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-900 last:border-0">
                      <div className="flex items-center gap-2">
                        {isAuthentic === true && (
                          <ShieldCheck className="w-3 h-3 text-green-400 shrink-0" />
                        )}
                        {isAuthentic === false && (
                          <span className="w-3 h-3 text-red-400 shrink-0 font-black text-[10px]">✗</span>
                        )}
                        {isAuthentic === null && (
                          <ScanLine className="w-3 h-3 text-zinc-600 shrink-0" />
                        )}
                        <span className="text-zinc-500 font-mono">
                          {new Date(event.createdAt).toLocaleString(undefined, {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${
                        isAuthentic === true ? 'text-green-400' :
                        isAuthentic === false ? 'text-red-400' :
                        'text-zinc-600'
                      }`}>
                        {isAuthentic === true ? 'Authentic' : isAuthentic === false ? 'Invalid' : 'No hash'}
                      </span>
                    </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
