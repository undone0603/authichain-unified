export const dynamic = 'force-dynamic';

import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Package,
  Sparkles,
  ScanLine,
  Clock,
} from 'lucide-react';
import { verifyHash, type QRVerificationRecord } from '../../../server/_core/verification';

interface PageProps {
  searchParams: Promise<{ id?: string; hash?: string }>;
}

export default async function VerifyPage({ searchParams }: PageProps) {
  const { id: productIdStr, hash } = await searchParams;

  const productId = productIdStr ? parseInt(productIdStr, 10) : NaN;

  if (!productIdStr || isNaN(productId)) {
    return <ErrorState message="Invalid verification link — product ID missing." />;
  }

  const supabase = await createClient();

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, brand, category, description, imageUrl, status, serialNumber, manufacturer, createdAt')
    .eq('id', productId)
    .single();

  if (productError || !product) {
    return <ErrorState message="Product not found on AuthiChain registry." />;
  }

  const { data: qrRows } = await supabase
    .from('qr_codes')
    .select('id, metadata, scanCount, qrData')
    .eq('productId', productId)
    .order('id', { ascending: false })
    .limit(1);

  const qrCode = qrRows?.[0] ?? null;
  const meta = qrCode?.metadata as Record<string, unknown> | null;

  let hashVerification: { valid: boolean; message: string } | null = null;

  if (hash && meta?.hash && meta?.expiresAt) {
    const record: QRVerificationRecord = {
      id:        (meta.verificationId as string) ?? '',
      hash:      meta.hash as string,
      productId: String(productId),
      issuedAt:  new Date(),
      expiresAt: new Date(meta.expiresAt as string),
      scanCount: qrCode?.scanCount ?? 0,
      revoked:   false,
    };
    const result = verifyHash(hash, record);
    hashVerification = { valid: result.valid, message: result.message };
  }

  const isAuthentic = hashVerification?.valid === true;
  const isCounterfeit = hashVerification !== null && !hashVerification.valid;
  const isUnverified = hashVerification === null;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-gold selection:text-black">
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Status Badge */}
        <div className="text-center mb-12">
          {isAuthentic && (
            <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-400 border border-green-500/20 px-8 py-4 rounded-full font-black uppercase tracking-widest animate-gold-pulse">
              <ShieldCheck className="w-6 h-6" />
              Authentic Product Verified
            </div>
          )}
          {isCounterfeit && (
            <div className="inline-flex flex-col items-center gap-3 bg-red-500/10 text-red-400 border border-red-500/20 px-8 py-6 rounded-2xl">
              <div className="flex items-center gap-2 font-black uppercase tracking-widest">
                <ShieldX className="w-6 h-6" />
                Counterfeit Alert
              </div>
              <p className="text-xs text-red-300/70 font-semibold max-w-xs text-center">
                {hashVerification?.message}
              </p>
            </div>
          )}
          {isUnverified && (
            <div className="inline-flex items-center gap-2 bg-zinc-700/20 text-zinc-400 border border-zinc-700/40 px-8 py-4 rounded-full font-black uppercase tracking-widest">
              <ScanLine className="w-6 h-6" />
              Product Found — No Hash Signature
            </div>
          )}
        </div>

        {/* Product Card */}
        <div className="protocol-card p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Package className="w-5 h-5 text-gold" />
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">
              Product Information
            </h2>
          </div>

          {product.imageUrl && (
            <div className="mb-6 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.imageUrl}
                alt={product.name}
                className="max-h-48 rounded-xl object-contain"
              />
            </div>
          )}

          <h1 className="text-3xl font-black mb-2 gold-text leading-tight">
            {product.name}
          </h1>
          {product.brand && (
            <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs mb-4">
              {product.brand}
            </p>
          )}
          {product.description && (
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              {product.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-6 border-t border-zinc-800 pt-6">
            {product.category && (
              <div>
                <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Category</h3>
                <p className="font-bold text-zinc-200 uppercase text-sm">{product.category}</p>
              </div>
            )}
            {product.manufacturer && (
              <div>
                <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Manufacturer</h3>
                <p className="font-bold text-zinc-200 uppercase text-sm">{product.manufacturer}</p>
              </div>
            )}
            {product.serialNumber && (
              <div>
                <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Serial Number</h3>
                <p className="font-mono font-bold text-gold text-sm">{product.serialNumber}</p>
              </div>
            )}
            <div>
              <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Registered</h3>
              <p className="font-bold text-zinc-200 text-sm">
                {new Date(product.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Hash Verification Detail */}
        {hash && (
          <div className={`protocol-card p-6 mb-8 ${isAuthentic ? 'border-green-500/20 bg-green-500/5' : isCounterfeit ? 'border-red-500/20 bg-red-500/5' : 'border-zinc-700/40'}`}>
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-4 h-4 text-zinc-500" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Cryptographic Verification
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-bold">Hash</span>
                <span className="font-mono text-zinc-300 truncate max-w-[200px]" title={hash}>
                  {hash.slice(0, 16)}…{hash.slice(-8)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-bold">Result</span>
                <span className={`font-black uppercase ${isAuthentic ? 'text-green-400' : isCounterfeit ? 'text-red-400' : 'text-zinc-400'}`}>
                  {isAuthentic ? 'Valid' : isCounterfeit ? 'Invalid' : 'Not checked'}
                </span>
              </div>
              {!!meta?.expiresAt && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-bold">Expires</span>
                  <span className="font-mono text-zinc-400">
                    {new Date(meta.expiresAt as string).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/"
            className="btn-gold w-full py-4 text-center rounded-xl font-black uppercase tracking-widest text-xs block shadow-gold"
          >
            Protect Your Brand &rarr;
          </Link>
          <div className="protocol-card p-6 bg-zinc-900/50 border-dashed border-zinc-800 text-center flex flex-col items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-gold" />
            <p className="text-[10px] text-zinc-500 uppercase font-bold">
              Want tamper-evident QR codes for your products?
            </p>
            <Link
              href="/?utm_source=verify_page&utm_medium=viral_loop"
              className="text-[10px] font-black text-gold hover:underline uppercase tracking-tighter"
            >
              Start Free &rarr;
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.2em]">
            Powered by{' '}
            <Link href="https://qron.space" className="text-zinc-400">QRON</Link>
            {' '}&middot; AuthiChain Protocol &middot; SHA-256 Verified
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }): React.ReactElement {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center gap-2 bg-zinc-800/50 text-zinc-400 border border-zinc-700/40 px-8 py-4 rounded-full font-black uppercase tracking-widest mb-8">
          <ShieldAlert className="w-6 h-6" />
          Verification Failed
        </div>
        <p className="text-zinc-500 text-sm mb-8">{message}</p>
        <Link
          href="/"
          className="btn-gold py-3 px-8 rounded-xl font-black uppercase tracking-widest text-xs shadow-gold"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
