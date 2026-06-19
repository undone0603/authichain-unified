'use client';

import { CheckCircle2, Shield, Star } from 'lucide-react';

interface VerifyWidgetProps {
  productId?: string;
  productName?: string;
  certificationNumber?: string;
  issuer?: string;
  issuedDate?: string;
  expiryDate?: string;
  verificationUrl?: string;
  trustScore?: number;
}

export default function VerifyWidget({
  productId = 'PROD-2024-001',
  productName = 'Authentic Product',
  certificationNumber = 'CERT-2024-AUTH-001',
  issuer = 'AuthiChain Certification',
  issuedDate = '2024-01-15',
  expiryDate = '2025-01-15',
  verificationUrl = 'https://authichain.com/verify',
  trustScore = 98,
}: VerifyWidgetProps) {
  const isExpired = expiryDate ? new Date(expiryDate) < new Date() : false;
  const daysUntilExpiry = expiryDate
    ? Math.ceil((new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="rounded-2xl bg-gradient-to-br from-emerald-900/20 to-green-900/20 border-2 border-emerald-500/30 p-6 shadow-2xl backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Verified</p>
              <p className="text-xs font-bold text-white">{issuer}</p>
            </div>
          </div>
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${
                  i < Math.round(trustScore / 20) ? 'fill-gold text-gold' : 'text-zinc-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Product Info */}
        <div className="mb-6 space-y-2">
          <p className="text-sm font-black text-white uppercase tracking-tight">{productName}</p>
          <p className="text-[10px] text-zinc-400 font-mono">{productId}</p>
        </div>

        {/* Certification Details */}
        <div className="mb-6 p-4 rounded-lg bg-black/40 border border-zinc-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Certification #</span>
            <span className="text-xs font-mono text-emerald-400">{certificationNumber}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Issued</span>
            <span className="text-xs text-zinc-300">{issuedDate}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Expires</span>
            <span className={`text-xs font-bold ${isExpired ? 'text-red-400' : daysUntilExpiry && daysUntilExpiry < 30 ? 'text-yellow-400' : 'text-emerald-400'}`}>
              {isExpired ? 'Expired' : expiryDate}
            </span>
          </div>
        </div>

        {/* Trust Score */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Trust Score</span>
            <span className="text-lg font-black text-emerald-400">{trustScore}%</span>
          </div>
          <div className="h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div className="h-full bg-gradient-to-r from-emerald-600 to-green-400 transition-all" style={{ width: `${trustScore}%` }} />
          </div>
        </div>

        {/* Verification Badge */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 mb-6">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-300">Tamper-Evident</span>
          </div>
          <span className="text-[8px] font-black text-emerald-400 uppercase">Verified</span>
        </div>

        {/* Verify Button */}
        <a
          href={verificationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm uppercase tracking-wider transition-colors text-center"
        >
          Verify on Blockchain
        </a>
      </div>
    </div>
  );
}
